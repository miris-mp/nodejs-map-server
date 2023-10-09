"use strict";

let cluster = require("cluster");

// NOTE: sizes are expressed in number of pixels
const TILE_LENGTH = 256;
const CIRCLE_RADIUS = 4;

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

  // hello world get
  app.get("/", (req, res) => {
    const responseData = { message: "Hello World!" };
    res.json(responseData);
  });

  // api res with points in img
  app.get("/api/v1/tiles/:zoom/:lon/:lat/", function (req, res) {
    //let coords = { x: 45, y: -45 }; // Test
    let zoom = req.params.zoom; // Test

    let coords = { lon: Number(req.params.lon), lat: Number(req.params.lat) };
    // const lat = 42; // Example center latitude
    // const lon = 13; // Example center longitude
    // let coords = { lon: lon, lat: lat };

    // let zoom = req.params.zoom;

    const [latCent, lonCent] = deg2num(coords.lat, coords.lon, zoom);

    let merc = new SphericalMercator({ size: TILE_LENGTH });
    // let bbox = merc.bbox(13, 42, 10);  // Test
    let bbox = merc.bbox(latCent, lonCent, zoom);

    // bbox default WGS84 = left,bottom,right,top
    // bbox = min Longitude , min Latitude , max Longitude , max Latitude

    // 16^2 = 256 -> tile
    let bboxOffset = 16 / Math.pow(2, zoom);

    // genera un numero di tile che corrisponde al livello di zoom inserito

    // extended bbox
    let bboxExt = [
      bbox[0] - bboxOffset, //west
      bbox[1] - bboxOffset, //south
      bbox[2] + bboxOffset, //east
      bbox[3] + bboxOffset, //north
    ];

    let canvas = Canvas.createCanvas(TILE_LENGTH, TILE_LENGTH);
    let context = canvas.getContext("2d");

    // save data of coords
    readGeoJSONFile("./data.geojson")
      .then((geojsonData) => {
        // loop on the data from geoJSON
        geojsonData.features.forEach((feature) => {
          let lon = feature.geometry.coordinates[0];
          let lat = feature.geometry.coordinates[1];

          // bbox = min Longitude , min Latitude , max Longitude , max Latitude
          // north & south = lat (-90; +90) - west & east = lon (-180; +180)
          if (
            bboxExt[0] < lon &&
            lon < bboxExt[2] &&
            bboxExt[1] < lat &&
            lat < bboxExt[3]
          ) {
            console.log("IL PUNTO APPARTIENE AL RANGE ", bbox);

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
            context.arc(relPos[0], relPos[1], CIRCLE_RADIUS, 0, Math.PI * 2);
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

function deg2num(lat_deg, lon_deg, zoom) {
  const lat_rad = (lat_deg * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const xtile = Math.floor(((lon_deg + 180) / 360) * n);
  const ytile = Math.floor(
    ((1 - Math.asinh(Math.tan(lat_rad)) / Math.PI) / 2) * n
  );

  console.log("DEG ", xtile, " and ", ytile);
  return [xtile, ytile];
}
