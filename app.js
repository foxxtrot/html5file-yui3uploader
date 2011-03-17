
/**
 * Module dependencies.
 */

var express = require('express'),
    form = require('connect-form');

var app = module.exports = express.createServer(form({ keepExtensions: true }));

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyDecoder());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.staticProvider(__dirname + '/public'));
  //app.use(form({ keepExtensions: true }));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

app.get('/', function(req, res){
  res.render('index', {
    locals: {
      title: 'HTML5 File Uploader'
    }
  });
});

app.post('/', function(req, res, next) {
    if(req.form) {
        req.form.on('progress', function(bytesReceived, bytesExpected){
            var percent = (bytesReceived / bytesExpected * 100) | 0;
                process.stdout.write('Uploading: %' + percent + '\r');
        });
        req.form.complete(function(err, fields, files) {
            if (err) {
                next(err);
            } else {
                console.log("\nupload %s to %s"
                    , files.files.filename
                    , files.files.path);
                if (req.headers['x-requested-by'] !== 'XMLHttpRequest') {
                    res.redirect('back');
                } else {
                    res.send('File processed.');
                }
            }
        });
    } else {
        console.log("POST recieved, but no form?");
        console.log(req.body);
        console.log(req.headers);
        res.send("Nothing to recieve");
    }
});

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(3000);
  console.log("Express server listening on port %d", app.address().port)
}
