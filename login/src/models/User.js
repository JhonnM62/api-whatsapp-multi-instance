const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
    },
    email: {
      type: String,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

//productSchema.statics.encryptPassword = async (password) => {
//const salt = await bcrypt.genSalt(10);
//return await bcrypt.hash(password, salt);
//};

/*productSchema.statics.comparePassword = async (password, receivedPassword) => {
  return await bcrypt.compare(password, receivedPassword)
}*/
productSchema.statics.comparePassword = (password, receivedPassword) => {
  return password === receivedPassword;
};

productSchema.pre("save", async function (next) {
  const user = this;
  if (!user.isModified("password")) {
    return next();
  }
  //const hash = await bcrypt.hash(user.password, 10);
  //user.password = hash;
  // si hay un archivo .p12 en la petición, procesarlo

  next();
});

module.exports = mongoose.model("User", productSchema);
