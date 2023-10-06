"use strict";

let cluster = require("cluster");

if (cluster.isMaster) {
  const CPUS = require("os").cpus();

  CPUS.forEach(function () {
    cluster.fork();
  });

  cluster.on("exit", function (worker) {
    console.log(`worker ${worker.process.pid} died`);
  });
} else if (cluster.isWorker) {
  let Canvas = require("canvas");
  const cors = require("cors");
  let app = require("express")();
  const fs = require("fs/promises");
  // https://github.com/mapbox/sphericalmercator
  let SphericalMercator = require("@mapbox/sphericalmercator");

  app.use(cors());

  // Server port
  const PORT = process.env.PORT || 8000;

  // NOTE: sizes are expressed in number of pixels
  const TILE_LENGTH = 256;
  const CIRCLE_RADIUS = 4;

  // hello world get
  app.get("/", (req, res) => {
    const responseData = { message: "Hello World!" };
    res.json(responseData);
  });

  // api res with points in img
  app.get("/api/v1/tiles/:zoom/:x/:y/", function (req, res) {
    //let coords = { x: 45, y: -45 }; // Test
    //let zoom = 1; // Test
    let coords = { x: req.params.x, y: req.params.y };
    let zoom = req.params.zoom;

    let merc = new SphericalMercator({ size: TILE_LENGTH });

    // Check
    console.log("lon ", coords.x);
    console.log("lat ", coords.y);

    // let bbox = merc.bbox(13, 42, 10);  // Test
    let bbox = merc.bbox(coords.x, coords.y, zoom);
    // bbox default WGS84 = left,bottom,right,top
    // bbox = min Longitude , min Latitude , max Longitude , max Latitude
    console.log("BBOX: ", bbox);

    let bboxOffset = 16 / Math.pow(2, zoom);

    // extended bbox
    let bboxExt = [
      bbox[0] - bboxOffset, //west
      bbox[1] - bboxOffset, //south
      bbox[2] + bboxOffset, //right
      bbox[3] + bboxOffset, //top
    ];

    console.log("BBOXExt: ", bboxExt);
    let canvas = Canvas.createCanvas(TILE_LENGTH, TILE_LENGTH);
    let context = canvas.getContext("2d");

    // save data of coords
    readGeoJSONFile("./data.geojson")
      .then((geojsonData) => {
        // loop on the data from geoJSON
        geojsonData.features.forEach((feature) => {
          let lon = feature.geometry.coordinates[0];
          let lat = feature.geometry.coordinates[1];

          let bboxPoint = merc.bbox(lon, lat, zoom);

          console.log("Punto ", bboxPoint);
          if (
            bboxExt[0] < bboxPoint[0] &&
            bboxPoint[2] < bboxExt[2] &&
            bboxExt[1] < bboxPoint[1] &&
            bboxPoint[3] < bboxExt[3]
          ) {
            console.log("Punto dentro");
          }
          // bbox = min Longitude , min Latitude , max Longitude , max Latitude
          if (
            bboxExt[0] < lon &&
            lon < bboxExt[2] &&
            bboxExt[1] < lat &&
            lat < bboxExt[3]
          ) {
            console.log("IL PUNTO APPARTIENE AL RANGE");

            // Convert lon, lat to screen pixel x, y
            // absolute pixel position of the border box NE and SW vertexes
            let sw = merc.px([bbox[0], bbox[1]], zoom);
            let ne = merc.px([bbox[2], bbox[3]], zoom);

            console.log("bbox ", sw, " e ", ne);

            // absolute pixel position of the feature
            let absPos = merc.px([lon, lat], zoom);

            // position of the point inside the tile
            let relPos = [absPos[0] - sw[0], absPos[1] - ne[1]];

            context.beginPath();
            context.fillStyle = "#000";

            console.log(feature);

            context.beginPath();
            context.fillStyle = "red";
            // context.arc(10, 10, CIRCLE_RADIUS, 0, Math.PI * 2);  // Test
            console.log("relative ", relPos);
            context.arc(
              relPos[0] / 1000,
              relPos[1] / 1000,
              CIRCLE_RADIUS,
              0,
              Math.PI * 2
            );
            context.closePath();
            context.fill();

            console.log(
              "-----------------------------------------------------------------"
            );
          }
        });
      })
      .catch((error) => {
        console.log("Errore ");
        console.log(error);
      });

    // CANVAS

    // set the Content-type header
    res.type("png");

    let stream = canvas.createPNGStream();
    let chunks = [];

    stream.on("data", function (chunk) {
      chunks.push(chunk);
    });

    stream.on("end", function () {
      let buf = Buffer.concat(chunks);
      res.send(buf);
    });
  });

  async function readGeoJSONFile(filePath) {
    let geojsonData;
    try {
      const data = await fs.readFile(filePath, { encoding: "utf8" });
      geojsonData = JSON.parse(data);
    } catch (err) {
      geojsonData = "";
    } finally {
      return geojsonData;
    }
  }

  app.listen(PORT);
  console.log(`Server running on port ${PORT}`);
}
