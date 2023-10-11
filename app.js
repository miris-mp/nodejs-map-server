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
    const width = 1200;
    const height = 620;

    const canvas = Canvas.createCanvas(width, height);
    const context = canvas.getContext("2d");

    context.fillStyle = "yellow";
    context.fillRect(0, 0, width, height);

    const buffer = canvas.toBuffer("image/png");

    const fsN = require("fs");
    fsN.writeFileSync("./image.png", buffer);

    res.json(responseData);
  });

  // api res with points in img
  app.get("/api/v1/tiles/:zoom/:lon/:lat/", function (req, res) {
    //let coords = { x: 45, y: -45 }; // Test
    let zoom = req.params.zoom; // Test

    let coords = { lon: Number(req.params.lon), lat: Number(req.params.lat) };
    // Expected: 13.865771, 42.986211]
    console.log("*************************************");
    console.log("Longitude and latitude client: ", coords);
    // const lat = 42; // Example center latitude
    // const lon = 13; // Example center longitude
    // let coords = { lon: lon, lat: lat };

    // let zoom = req.params.zoom;

    const [latCent, lonCent] = deg2num(coords.lat, coords.lon, zoom);

    let merc = new SphericalMercator({ size: TILE_LENGTH });
    // let bbox = merc.bbox(13, 42, 10);  // Test
    let bbox = merc.bbox(latCent, lonCent, zoom);

    console.log("Bbox calculated ", bbox);
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
    console.log("bbox estesa ", bboxExt);

    let canvas = Canvas.createCanvas(TILE_LENGTH, TILE_LENGTH);
    let context = canvas.getContext("2d");

    // save data of coords
    readGeoJSONFile("./data.geojson")
      .then((geojsonData) => {
        // loop on the data from geoJSON
        geojsonData.features.forEach((feature) => {
          let lon = feature.geometry.coordinates[0];
          let lat = feature.geometry.coordinates[1];

          console.log(
            "Longitutude and latitude of the point to check ",
            lon,
            lat
          );
          // bbox = min Longitude , min Latitude , max Longitude , max Latitude
          // north & south = lat (-90; +90) - west & east = lon (-180; +180)
          if (
            bboxExt[0] < lon &&
            lon < bboxExt[2] &&
            bboxExt[1] < lat &&
            lat < bboxExt[3]
          ) {
            console.log("Data is inside Bbox");

            const bboxWidth = bboxExt[2] - bboxExt[0]; // Degrees of longitude
            const bboxHeight = bboxExt[3] - bboxExt[1]; // Degrees of latitude

            const relativeX = (lon - bboxExt[0]) / bboxWidth;
            const relativeY = (bboxExt[3] - lat) / bboxHeight;

            const tileX = relativeX * 256;
            const tileY = relativeY * 256;

            console.log(
              "Position in the tile ",
              Math.floor(tileX),
              " ",
              Math.floor(tileY)
            );

            context.beginPath();
            context.fillStyle = "red";
            context.arc(tileX, tileY, CIRCLE_RADIUS, 0, Math.PI * 2);
            context.closePath();
            context.fill();
            console.log(
              "-----------------------------------------------------------------"
            );
          }
        });
        const buffer = canvas.toBuffer("image/png");

        const fsN = require("fs");
        fsN.writeFileSync("./image.png", buffer);

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
      })
      .catch((error) => {
        console.log("Errore ");
        console.log(error);
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

  console.log("Result deg2num values ", xtile, " and ", ytile);
  return [xtile, ytile];
}
