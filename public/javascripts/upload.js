YUI.add('io-file', function(Y) {
    var io = Y.io,
        sub = Y.Lang.sub,
        data = {},
        laterHandle,
        checkForUpload = function() {
            Y.Object.each(data, function(val, key, obj) {
                if (val.processed === val.config.files.length) {
                    var headers = val.config.headers || {}, boundary = val.config.boundary, parts = val.parts;

                    val.config.data = ['--', boundary, '\r\n', val.parts.join(['\r\n--', boundary, '\r\n'].join('')), "\r\n--", boundary, "--\r\n"].join('');
                    val.config.headers = Y.merge(headers, { 'Content-Type': ['multipart/form-data; boundary=', boundary].join('')});

                    Y.io.http(val.uri, val.config, key);

                    delete obj[key];
                }
            });
            if (Y.Object.isEmpty(data)) {
                laterHandle.cancel();
                laterHandle = undefined;
            }
        };
    io.file = function(uri, c, i) {
        var parts = [], f;
        c = c || {};
        i = i || io._id();
        c.boundary = c.boundary || Y.guid();
        c.method = 'POST';
        if(c.form) {
            f = Y.io._serialize(c.form, c.data).split('&');
            Y.Array.each(f, function(rec) {
                var key, value;
                rec = rec.split('=');
                key = rec[0]; value = rec[1];

                if (value !== '') {
                    parts.push(['Content-Disposition: form-data; name="' + key + '"', "", value].join('\r\n'));
                }
            });
            // I don't want io itself to process the form object
            delete c.form;
        }
        data[i] = {
            config: c,
            parts: parts,
            uri: uri,
            id: i,
            processed: 0
        };
        Y.Array.each(c.files, function(file) {
            var reader = new FileReader();

            reader.onload = function(e) {
                parts.push([sub('Content-Disposition: form-data; name="files"; filename="{name}"', file),
                   sub("Content-Type: {type}", file),
                   "Content-Transfer-Encoding: base64",
                   "",
                   reader.result.split(',')[1]].join('\r\n'));
                data[i].processed += 1;
            };
            reader.readAsDataURL(file);
        });

        if (!laterHandle) {
            laterHandle = Y.later(500, Y, checkForUpload, null, true);
        }
    };
}, '1.0.0', { requires: ['io-base', 'io-form'] });

YUI({filter: 'RAW'}).use('node', 'node-event-simulate', 'io-file', function(Y) {
    var uploadList = Y.one('#uploadList');
    Y.on('change', function(ev) {
        var files = Y.NodeList.getDOMNodes(ev.target.get('files'));
        Y.Array.each(files, function(file) {
            var reader = new FileReader(),
                build = Y.Node.create(Y.Lang.sub("<li><form method='post' enctype='multipart/form-data'><div class='img-container'><img /></div><dl><dt><label for='title-{id}'>Title</label></dt><dd><input type='text' name='title' value='{path}' /></dd><dt><label for='tags'>Tags</tags></dt><dd><input type='text' name='tags' /></dd><dd><input type='reset' value='Remove' /><input type='submit' value='Upload' /></dd></dl></form></li>", {path: file.name})),
                img = build.one('img');
            img.setData('file', file);

            reader.onload = function(ev) {
                var imgHeight, imgWidth, containerDimensions = 150;
                img.set('src', reader.result);
                imgHeight = parseInt(img.getStyle('height'), 10);
                imgWidth = parseInt(img.getStyle('width'), 10);

                if (imgHeight <= containerDimensions && imgWidth <= containerDimensions) {
                    img.setStyle('padding', ((containerDimensions - imgHeight)/2) + 'px ' + ((containerDimensions - imgWidth)/2) + 'px');
                } else if ( imgHeight > imgWidth) {
                    img.setStyle('height', containerDimensions + 'px');
                    imgWidth = (containerDimensions / imgHeight) * imgWidth;
                    img.setStyle('width', imgWidth + 'px');
                    img.setStyle('padding', '0px ' + ((containerDimensions - imgWidth)/2) + 'px');
                } else {
                    img.setStyle('width', containerDimensions + 'px');
                    imgHeight = (containerDimensions / imgWidth) * imgHeight;
                    img.setStyle('height', imgHeight + 'px');
                    img.setStyle('padding', ((containerDimensions - imgHeight)/2) + 'px 0px');
                }
            };
            reader.readAsDataURL(file);
            uploadList.append(build);
        });
    }, '#fileElem');

    uploadList.delegate('click', function(ev) {
        var form = ev.target.ancestor('form');
        if (ev.target.test('[type=reset]')) {
            // TODO: Animate this out.
            form.ancestor('li').destroy(true);
        }
    }, "input[type=reset],input[type=submit]");

    uploadList.delegate('submit', function(ev) {
        Y.log('Form submission caught.', 'info');
        var form = ev.target;
        //form.append('<input type="file" name="files" />');
        //form.one('input[type=file]').set('files', form.one('img').getData('file'));
        ev.preventDefault();
        //return;
        Y.io.file('/',
            {
                method: "POST",
                headers: {
                    'Accept': 'application/json'
                },
                form: {
                    id: Y.Node.getDOMNode(form)
                },
                files: [
                    form.one('img').getData('file')
                ]
            });
        //ev.target.ancestor('dd').destroy(true);
    }, "form");
});
