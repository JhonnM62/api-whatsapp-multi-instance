if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

//modulos de login
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
require("./login/src/database");

const usersRoutes = require("./login/src/routes/user.routes");
const authRoutes = require("./login/src/routes/auth.routes");

const verifyToken = require("./login/src/middlewares/authJwt");

const {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
} = require("@bot-whatsapp/bot");

const BaileysProvider = require("@bot-whatsapp/provider/baileys");
const MockAdapter = require("@bot-whatsapp/database/mock");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");
const { convertAudio } = require("./convertidor-audio");
const express = require("express");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
const PORT = process.env.PORT;

const sessions = {};

const createBotSession = async (BOTNAME) => {
  if (!sessions[BOTNAME]) {
    // Obtiene el puerto específico del archivo .env

    if (!PORT) {
      console.error(
        `No se ha definido el puerto para ${BOTNAME} en el archivo .env.`
      );
      return;
    }

    // Crea las instancias de adapterFlow, adapterProvider y adapterDB aquí
    const adapterFlow = createFlow([]);
    const adapterProvider = createProvider(BaileysProvider, { name: BOTNAME });
    const adapterDB = new MockAdapter();

    // Crea la sesión solo si aún no existe para este BOTNAME
    sessions[BOTNAME] = {
      adapterDB: adapterDB,
      adapterFlow: adapterFlow,
      adapterProvider: adapterProvider,
    };

    createBot({
      flow: adapterFlow,
      provider: adapterProvider,
      database: adapterDB,
    });

    /*
          envia texto a un contacto
          */

    // Configuración de Multer para almacenar imágenes en la carpeta 'public/uploads'
    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, "public/uploads");
      },
      filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
      },
    });
    const upload = multer({ storage: storage });
    app.use(express.static(path.join(__dirname, "public")));
    console.log(path.join(__dirname, "public"));
    // Configuración de la vista EJS
    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "views"));

    // Ruta para la página principal
    app.get("/", (req, res) => {
      try {
        res.render("index", { imagePath: null }); // Inicializa imagePath como null
      } catch (error) {
        console.error("Error:", error);
        res
          .status(500)
          .json({ error: "Error al renderizar la página principal" });
      }
    });

    // Rutas
    app.get("/login", (req, res) => {
      try {
        res.render("login");
      } catch (error) {
        console.error("Error:", error);
        res
          .status(500)
          .json({ error: "Error al renderizar la página de inicio de sesión" });
      }
    });

    app.get("/register", (req, res) => {
      try {
        res.render("register");
      } catch (error) {
        console.error("Error:", error);
        res
          .status(500)
          .json({ error: "Error al renderizar la página de registro" });
      }
    });

    // Ruta para manejar la carga de imágenes
    app.post("/upload", upload.single("file"), async (req, res) => {
      try {
        if (!req.file) {
          return res
            .status(400)
            .json({ error: "No se ha proporcionado ningún archivo" });
        }

        const imagePath = "./public/uploads/" + req.file.filename;
        console.log(imagePath);
        // Verifica si el archivo subido es un archivo de audio
        if (req.file.mimetype.startsWith("audio/")) {
          // Aquí deberías implementar la función convertAudio(url) que convierte el archivo de audio
          const convertedAudioPath = await convertAudio(imagePath);
          // Elimina el archivo original después de la conversión
          fs.unlink(imagePath, (err) => {
            if (err) {
              console.error("Error al eliminar el archivo original:", err);
            } else {
              const rutaCorregida =
                "./" + convertedAudioPath.replace(/\\/g, "/");
              // Pasa la ruta del archivo de audio convertido a la vista
              res.render("index", { imagePath: rutaCorregida });
            }
          });
        } else {
          res.render("index", { imagePath }); // Pasa imagePath a la vista
        }
      } catch (error) {
        console.error("Error:", error);
        res
          .status(500)
          .json({ error: "Error al cargar o convertir el archivo" });
      }
    });

    app.post(
      "/upload2",
      verifyToken,
      upload.single("file"),
      async (req, res) => {
        try {
          if (!req.file) {
            return res
              .status(400)
              .json({ error: "No se ha proporcionado ningún archivo" });
          }

          const imagePath = "./public/uploads/" + req.file.filename;

          // Verifica si el archivo subido es un archivo de audio
          if (req.file.mimetype.startsWith("audio/")) {
            // Aquí deberías implementar la función convertAudio(url) que convierte el archivo de audio
            const convertedAudioPath = await convertAudio(imagePath);
            // Elimina el archivo original después de la conversión
            await fs.unlink(imagePath);
            const rutaCorregida = "./" + convertedAudioPath.replace(/\\/g, "/");
            // Pasa la ruta del archivo de audio convertido a la vista
            res.status(200).json({ rutaCorregida }); // Responde con la ruta de la imagen subida
          } else {
            res.status(200).json({ imagePath }); // Responde con la ruta de la imagen subida
          }
        } catch (error) {
          console.error("Error:", error);
          res
            .status(500)
            .json({ error: "Error al cargar o convertir el archivo" });
        }
      }
    );

    // Define una ruta genérica que incluye el nombre del bot como parte de la URL
    app.post("/:botName/send-message", verifyToken, async (req, res) => {
      try {
        const { botName } = req.params;
        const { number, message } = req.body;

        // Verifica si existe una sesión para el bot especificado
        if (!sessions[botName]) {
          res.status(404).json({ error: "Bot no encontrado" });
          return;
        }

        const modProvider = await sessions[
          botName
        ].adapterProvider.getInstance();
        await modProvider.sendMessage(`${number}@c.us`, { text: message });

        res.send({ data: "Mensaje Enviado!" });
      } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Error al enviar el mensaje de texto" });
      }
    });

    app.post("/:botName/send-image", verifyToken, async (req, res) => {
      try {
        const { botName } = req.params;
        const { number, url, caption } = req.body;

        const modProvider = await sessions[
          botName
        ].adapterProvider.getInstance();

        await modProvider.sendMessage(`${number}@c.us`, {
          image: { url: url },
          caption: caption,
        });

        res.status(200).json({ data: "Imagen Enviada!" });
      } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Error al enviar la imagen" });
      }
    });

    /*
        envia un archivo PDF
        */
    app.post("/:botName/send-pdf", async (req, res) => {
      try {
        const { botName } = req.params;
        const { number, url, caption } = req.body;
        // Verifica si existe una sesión para el bot especificado
        if (!sessions[botName]) {
          res.status(404).json({ error: "Bot no encontrado" });
          return;
        }

        const mimeType = mime.lookup(url);

        const modProvider = await sessions[
          botName
        ].adapterProvider.getInstance();
        await modProvider.sendMessage(`${number}@c.us`, {
          document: { url: url },
          mimetype: mimeType,
          fileName: caption,
        });
        res.send({ data: "Documento Enviado!" });
      } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Error al enviar el documento PDF" });
      }
    });

    /*
        envia un archivo AUDIO
        */
    app.post("/:botName/send-audio", async (req, res) => {
      try {
        const { botName } = req.params;
        const { number, url } = req.body;
        // Verifica si existe una sesión para el bot especificado
        if (!sessions[botName]) {
          res.status(404).json({ error: "Bot no encontrado" });
          return;
        }

        const modProvider = await sessions[
          botName
        ].adapterProvider.getInstance();
        await modProvider.sendMessage(`${number}@c.us`, {
          audio: { url: url },
          ptt: true,
        });
        res.send({ data: "Audio Enviado!" });
      } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Error al enviar el archivo de audio" });
      }
    });

    /*
        envia un archivo VIDEO
        */
    app.post("/:botName/send-video", async (req, res) => {
      try {
        const { botName } = req.params;
        const { number, url, caption } = req.body;
        // Verifica si existe una sesión para el bot especificado
        if (!sessions[botName]) {
          res.status(404).json({ error: "Bot no encontrado" });
          return;
        }
        const modProvider = await sessions[
          botName
        ].adapterProvider.getInstance();
        await modProvider.sendMessage(`${number}@c.us`, {
          video: { url: url },
          caption: caption,
          gifPlayback: true,
        });
        res.send({ data: "Video Enviado!" });
      } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Error al enviar el video" });
      }
    });

    /*
        envia una locacion a un contacto
        */
    app.post("/:botName/send-location", async (req, res) => {
      try {
        const { botName } = req.params;
        const { number, lat, long } = req.body; // Verifica si existe una sesión para el bot especificado
        if (!sessions[botName]) {
          res.status(404).json({ error: "Bot no encontrado" });
          return;
        }
        const modProvider = await sessions[
          botName
        ].adapterProvider.getInstance();
        await modProvider.sendMessage(`${number}@c.us`, {
          location: { degreesLatitude: lat, degreesLongitude: long },
        });
        res.send({ data: "Locacion Enviada!" });
      } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Error al enviar la ubicación" });
      }
    });

    /*
        envia botones a un contacto
        */
    app.post("/:botName/send-buttons", async (req, res) => {
      try {
        const { botName } = req.params;
        const { number, text, footer, databuttons } = req.body;
        const buttons = databuttons;
        // Verifica si existe una sesión para el bot especificado
        if (!sessions[botName]) {
          res.status(404).json({ error: "Bot no encontrado" });
          return;
        }
        const buttonMessage = {
          text,
          footer,
          buttons: buttons,
          headerType: 1,
        };

        const modProvider = await sessions[
          botName
        ].adapterProvider.getInstance();
        await modProvider.sendMessage(`${number}@c.us`, buttonMessage);
        res.send({ data: "Botones Enviados!" });
      } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Error al enviar los botones" });
      }
    });

    /*
        envia una lista a un contacto
        */
    app.post("/:botName/send-list", async (req, res) => {
      try {
        const { botName } = req.params;
        const { number, datasections, text, title, footer, buttonText } =
          req.body;
        const sections = datasections;
        // Verifica si existe una sesión para el bot especificado
        if (!sessions[botName]) {
          res.status(404).json({ error: "Bot no encontrado" });
          return;
        }
        const listMessage = {
          text,
          footer,
          title,
          buttonText,
          sections,
        };

        const modProvider = await sessions[
          botName
        ].adapterProvider.getInstance();
        await modProvider.sendMessage(`${number}@c.us`, listMessage);
        res.send({ data: "Lista Enviada!" });
      } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Error al enviar la lista" });
      }
    });

    app.get("/:botName/on", async (res) => {
      try {
        const { botName } = req.params; // Verifica si existe una sesión para el bot especificado
        if (!sessions[botName]) {
          res.status(404).json({ error: "Bot no encontrado" });
          return;
        }
        GLOBAL = true;
        res.send("PRENDIDO");
      } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Error al activar el estado" });
      }
    });

    app.get("/:botName/on", function (req, res) {
      try {
        const { botName } = req.params; // Verifica si existe una sesión para el bot especificado
        if (!sessions[botName]) {
          res.status(404).json({ error: "Bot no encontrado" });
          return;
        }
        GLOBAL_STATE = true;
        res.send("PRENDIDO");
      } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Error al activar el estado" });
      }
    });

    app.get("/auth-qr/:botName", async (req, res) => {
      try {
        const botName = req.params.botName;
        if (!botName || !sessions[botName]) {
          res.status(404).send({ error: "Bot no encontrado" });
          return;
        }

        // Ruta qr basada en el parámetro botName
        const file = path.resolve(__dirname, `./${botName}.qr.png`);
        res.sendFile(file);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Error al enviar QR" });
      }
    });
  }
};

const main = async () => {
  // Obtén los nombres de los bots dinámicamente desde el entorno
  const botNames = Object.keys(process.env)
    .filter((key) => key.startsWith("BOT_"))
    .map((key) => process.env[key]);

  if (botNames.length === 0) {
    console.error("No se han definido nombres válidos de BOT en el entorno.");
    return;
  }

  // Ejecuta las sesiones para los bots especificados en botNames
  for (const BOTNAME of botNames) {
    await createBotSession(BOTNAME);
  }

  // Routes login
  app.use("/api/users", usersRoutes);
  app.use("/api/auth", authRoutes);

  app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
  // Middlewares
  app.use(
    cors({
      origin: `http://localhost:${PORT}`,
    })
  );
  app.use(helmet());
  app.use(morgan("dev"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
};

// Llama a la función main para ejecutar las sesiones especificadas en BOTNAMES del archivo .env
main();
