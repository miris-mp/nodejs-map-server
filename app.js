"use strict";
const cors = require("cors");
let app = require("express")();
const fs = require("fs/promises");
let Canvas = require("canvas");
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
app.get("/api/v1/tiles/:zoom/:x/:y/:mark?/:all?", function (req, res) {
  /** Parameters */
  let mark = req.params.mark;

  let coords = { x: req.params.x, y: req.params.y };
  console.log("Coords ATTENZIONE FORSE DA INVERTIRE ", coords);
  let zoom = req.params.zoom;

  console.log("lon ", coords.x);
  console.log("lat ", coords.y);
  let merc = new SphericalMercator({ size: TILE_LENGTH });
  let bbox = merc.bbox(coords.x, coords.y, zoom);

  let bboxOffset = 16 / Math.pow(2, zoom);

  // extended bbox used for query
  let bboxExt = [
    bbox[0] - bboxOffset,
    bbox[1] - bboxOffset,
    bbox[2] + bboxOffset,
    bbox[3] + bboxOffset,
  ];

  var path_str = `/ws/?bbox=${bboxExt}&zoom_level=${zoom}`;

  if (mark) {
    path_str += `&mark=${mark}`;
  }

  console.log("BBBBB");
  console.log(bboxExt);

  // save data of coords
  readGeoJSONFile("./data.geojson")
    .then((geojsonData) => {
      let canvas = Canvas.createCanvas(TILE_LENGTH, TILE_LENGTH);
      let context = canvas.getContext("2d");

      // absolute pixel position of the border box NE and SW vertexes
      let sw = merc.px([bbox[0], bbox[1]], zoom);
      let ne = merc.px([bbox[2], bbox[3]], zoom);

      console.log("GGEO ", geojsonData);
      geojsonData.features.forEach((feature) => {
        let lon = feature.geometry.coordinates[0];
        let lat = feature.geometry.coordinates[1];

        // absolute pixel position of the feature
        let absPos = merc.px([lon, lat], zoom);

        // position of the point inside the tile
        let relPos = [absPos[0] - sw[0], absPos[1] - ne[1]];

        context.beginPath();
        context.fillStyle = "#000";

        var img = new Canvas.Image();
        img.src = feature;
        context.drawImage(img, relPos[0], relPos[1], TILE_LENGTH, TILE_LENGTH);

        // context.arc(relPos[0], relPos[1], CIRCLE_RADIUS, 0, Math.PI * 2);
        context.closePath();
        context.fill();
        // context.fillText("Big smile!", 10, 90);

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

        console.log(
          "-------------------------------------------------------------------------"
        );
        console.log(
          "-------------------------------------------------------------------------"
        );
      });
    })
    .catch((error) => {
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
