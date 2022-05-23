var recomendation = require('./index').Utils

recomendation.getBestRecomendations('./images/chair/001.530.69.jpg', (recomendations) => {
    console.log(recomendations);
});