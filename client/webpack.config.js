config = {
  entry: "./src/app.js",
  output: {
    filename: "bundle.js",
    path: "/Users/user/Development/City4Age/app/www/js"
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  module:{
    rules: [
      {
        test: /(\.js|\.jsx)$/,
        exclude: /(node_modules|bower_components)/,
        use: [
          {
            loader: 'babel-loader', // 'babel-loader' is also a legal name to reference
            query: {
              presets: ['es2015']
            }
          },
        ]
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

