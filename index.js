const common = require("oci-common");
const fs = require('fs');
const math = require('mathjs')
var walk    = require('walk');
const aivision = require("oci-aivision");
const path = require('path')
const _ = require('loadsh')
const getColors = require('get-image-colors')

/*
    Init Variables
*/
var datasetFile = 'dataset.json';
var productsFileName = 'products_dict.json';
var files   = [];
var walker  = walk.walk('./images', { followLinks: false });
const configurationFilePath = "~/.oci/config";
const configProfile = "wedoia";
const provider = new common.ConfigFileAuthenticationDetailsProvider(configurationFilePath, configProfile);



/* 
    The walker analyzes the image directory.
    - Calls the vision service to get the labels of the image and the confidence.
    - Calls the library get_colors to get a list of the most used colors on the image.
*/
walker.on('file', function(root, stat, next) {
    files.push(root + '/' + stat.name);
    next();
});

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
}
walker.on('end', function() {
    if (!fs.existsSync(datasetFile)){
        fs.writeFileSync(datasetFile, "[]", 'utf8', (error) => {console.log("Error writing")});
        var interval = 3 * 1000;

        var counter = 0;
        for (let index = 0; index < files.length; index++) {
            setTimeout( function(){
                function callback(fileName, labels, colors){
                    fs.readFile(datasetFile, 'utf8', function readFileCallback(err, data){
                        if (err){
                            console.log(err);
                        } else {
                        obj = JSON.parse(data);
                        obj.push({img : fileName, labels: labels, colors: colors});
                        json = JSON.stringify(obj);
                        fs.writeFile(datasetFile, json, 'utf8', (some) => {});
                    }});
                }
                getAllLabels(files[index], callback);
            },
            index * interval
            );
            
        }
        
    }
});

/**
 * Calls the vision service to get the most important categories of the image.
 * @param {*} fileName 
 * @returns 
 */
function getImageLabels(fileName){
    const contents = fs.readFileSync(fileName, {encoding: 'base64'});

        try {
          const client = new aivision.AIServiceVisionClient({ authenticationDetailsProvider: provider });
      
          const analyzeImageDetails = {
            features: [
              {
                featureType: "IMAGE_CLASSIFICATION"
              }
            ],
            image: {
              source: "INLINE",
              data: contents
            }
          };
      
          const analyzeImageRequest = {
            analyzeImageDetails: analyzeImageDetails
          };
      
          const analyzeImageResponse = client.analyzeImage(analyzeImageRequest);

          return analyzeImageResponse;
          
        } catch (error) {
          console.log("analyzeImage Failed with error  " + error);
        }

      return null;
}

/**
 * Calls the function getImageLabels to get label of an image, and also the colors.
 * @param {*} fileName Filepath of image
 * @param {*} callback Callback function with response
 */
function getAllLabels(fileName, callback){
    (async () => {
        const response = await getImageLabels(fileName);
        
        getColors(path.join(__dirname, fileName), function (err, palette) {
            var colors = [];
            palette.forEach(element => {
                colors.push({color: element._rgb.slice(0, 3)})
            });

            callback(fileName, response.analyzeImageResult.labels, colors);
        });
    })();
}

/**
 * Calculate an score of how much two images are relared based on the categories of the images and their colors.
 * @param {*} imgOne 
 * @param {*} imgTwo 
 * @returns 
 */
function getScoreBetweenImages(imgOne, imgTwo){
    var score = 0;
    for (let index = 0; index < imgOne.labels.length; index++) {
      const labelOne = imgOne.labels[index];
      var labelTwoConfidence = 0;
      imgTwo.labels.forEach(labelTwo => {
        if(labelTwo.name == labelOne.name){
          labelTwoConfidence = labelTwo.confidence;
        }
      });
      
      score += labelTwoConfidence - labelOne.confidence;
    }
    // var maxDistance = math.distance([0,0,0], [255, 255, 255]); => 441 to high
    var maxDistance = 50;
    for (let index = 0; index < imgOne.colors.length; index++) {
      const labelOne = imgOne.colors[index];
      var minDiff = Number.POSITIVE_INFINITY;
      imgTwo.colors.forEach(labelTwo => {
        var distance = math.distance(labelOne.color, labelTwo.color);
        if(distance < minDiff){
            minDiff = distance;
        }
      });
      score-= minDiff/maxDistance;
    }

    return score;
  }

/**
 * Gets a list of the 5 best matches comparing the input image against the dataset.
 * @param {*} fileName 
 * @param {*} recomendationCallback 
 */
function getBestRecomendations(fileName, recomendationCallback){

    function callback(fileName, labels, colors){
        var scores = [];
        var imgObj = {img : fileName, labels: labels, colors: colors};
        const data = fs.readFileSync(datasetFile, {encoding:'utf8', flag:'r'});
        var dataset = JSON.parse(data);
        dataset.forEach(element => {
            var score = getScoreBetweenImages(imgObj, element);
            scores.push({img: element.img, score: score});
        });
        
        scores.sort((a,b) =>  b.score - a.score);

        var recomendations = scores.slice(0, 3);
        var otherRecomendations = scores.slice(3, 10);
        var randomRecomendations = _.sampleSize(otherRecomendations, 3);
        recomendations.push(...randomRecomendations);

        const productsFile = fs.readFileSync(productsFileName, {encoding:'utf8', flag:'r'});
        var products = JSON.parse(productsFile);

        var response = []
        recomendations.forEach(r => {
            var key = r.img.substr(0, r.img.length-4).substr(r.img.lastIndexOf('/')+1);
            response.push(products[key]);
        });

        recomendationCallback(response);
    }

    getAllLabels(fileName, callback);
}
