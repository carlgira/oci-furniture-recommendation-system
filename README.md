# Recomendation Systen
Nodejs app to recomend furniture using a ikea dataset based on a input image.

Use the function "getBestRecomendations" to get the list of recomendations.


```javascript
 getBestRecomendations('./images/chair/001.530.69.jpg', (recomendations) => {
    console.log(recomendations);
});
```

## Build
```
npm install
```

## Run
```
OCI_CONFIG=<path-to-oci-config> OCI_PROFILE=<oci-profile> npm test
```
