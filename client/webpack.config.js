const path = require('path');

config = {
  entry: "./src/app.js",
  output: {
    filename: "bundle.js",
    path: path.resolve("../www/js")
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  module:{
    rules: [
      {
        test: /(\.js|\.jsx)$/,
        exclude: /node_modules/,
        loader: "babel-loader"
      },
      {
        test: /\.css$/,
        use: [
          "style-loader",
          "css-loader" 
        ]
      }
    ]
  },
  devtool: 'source-map'
}

module.exports = config;

