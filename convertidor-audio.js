const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const path = require("path");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const convertAudio = async (filePath = null, outputFormat = "opus") => {
  const formats = {
    mp3: {
      codec: "libmp3lame",
      ext: "mp3",
    },
    ogg: {
      codec: "libvorbis",
      ext: "ogg",
    },
    // Agrega más formatos de salida y sus códecs y extensiones aquí
    wav: {
      codec: "pcm_s16le",
      ext: "wav",
    },
    opus: {
      codec: "libopus",
      ext: "opus",
    },
  };

  if (!formats[outputFormat]) {
    throw new Error(`El formato de salida '${outputFormat}' no es compatible.`);
  }

  const outputPath = path.join(
    path.dirname(filePath),
    `${path.basename(filePath, path.extname(filePath))}.${
      formats[outputFormat].ext
    }`
  );

  await new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .audioCodec(formats[outputFormat].codec)
      .format(formats[outputFormat].ext)
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

  return outputPath;
};
module.exports = { convertAudio };
