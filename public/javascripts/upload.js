YUI.add('io-file-xdr2', function(Y) {
    var io = Y.io,
        sub = Y.Lang.sub;

    // Y.io is incredibly inflexible right now.

    io.file = function(uri, c, i) {
        var parts = [], f, fd,
            xhr = w.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');

        c = c || {};
        i = i || io._id();

        c.boundary = c.boundary || Y.guid();
        c.method = 'POST';
        c.headers = Y.merge(c.headers, { 'Content-Type': ['multipart/form-data; boundary=', c.boundary].join('')});
        if (c.form) {
            if (typeof(c.form) === 'string') {
                f = Y.Selector.query(document, '#' + c.form, true)[0];
            } else {
                // Allow Y.Node or DOM Node, works more like existing io-form impl
                f = c.form._node || c.form;
            }
            delete c.form;
            fd = new FormData(f);
        } else {
            fd = new FormData();
        }
        Y.Array.each(c.files, function(file) {
            fd.append('file', file);
        });
        c.data = fd;
        return Y.io.http(uri, c, i);
    };
}, '1.0.0', { requires: ['io-base', 'io-form'], supersedes: 'io-file'});


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
                    // Quoted Boundaries don't work in the connect server for NodeJS, hence why this in not quoated.
                    // I've submitted a patch fixing the defect, but for now, I'm just going to leave this unqouted.
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
        var parts = [], f, fd;
        c = c || {};
        i = i || io._id();
        c.boundary = c.boundary || Y.guid();
        c.method = 'POST';
        c.headers = Y.merge(c.headers, { 'Content-Type': ['multipart/form-data; boundary=', c.boundary].join('')});
        // TODO: Extract this into a method so that the implementation can be conditionally loaded
        if(Y.config.win.FormData) {
            if (c.form) {
                if (typeof(c.form) === 'string') {
                    f = Y.Selector.query(document, '#' + c.form, true)[0];
                } else {
                    // Allow Y.Node or DOM Node, works more like existing io-form impl
                    f = c.form._node || c.form;
                }
                delete c.form;
                fd = new FormData(f);
            } else {
                fd = new FormData();
            }
            Y.Array.each(c.files, function(file) {
                fd.append('file', file);
            });
            c.data = fd;
            return Y.io.http(uri, c, i);
        } else {
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
                    Y.log('FileSize: ' + file.size);
                    Y.log('Result Size:' + reader.result.length);
                    // Per RFC 2616 HTTP is not a MIME compliant protocol, whereas I was trying to
                    // upload as Base64 using the Content-Transfer-Encoding MIME Header, that is
                    // not supported. This sucks a bit.
                    parts.push([sub('Content-Disposition: form-data; name="files"; filename="{name}"', file),
                       sub("Content-Type: {type}", file),
                       "",
                       reader.result].join('\r\n'));
                    data[i].processed += 1;
                };
                reader.readAsBinaryString(file);
            });

            if (!laterHandle) {
                laterHandle = Y.later(500, Y, checkForUpload, null, true);
            }
        }
    };
}, '1.0.0', { requires: ['io-base', 'io-form'] });

YUI({filter: 'RAW'}).use('node', 'node-event-simulate', 'io-file', function(Y) {
    var uploadList = Y.one('#uploadList'),
        transistions = {
            shrinkOut: {
                easing: 'ease-out',
                duration: 0.75,
                height: '0px'
            }
        }
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
                img.setStyle('visibility', 'hidden');
                imgHeight = parseInt(img.getStyle('height'), 10);
                imgWidth = parseInt(img.getStyle('width'), 10);

                Y.later(25, null, function() {
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
                    img.setStyle('visibility', '');
                });
            };
            reader.readAsDataURL(file);
            uploadList.append(build);
        });
    }, '#fileElem');

    uploadList.delegate('click', function(ev) {
        var form = ev.target.ancestor('form'),
            container = form.ancestor('li');
        if (ev.target.test('[type=reset]')) {
            // TODO: Animate this out.
            container.remove(transistions.shrinkOut);
            container.destroy(true);
        }
    }, "input[type=reset]");

    Y.on('click', function(ev) {
        Y.one('#fileElem').simulate('click');
    }, "#addFile");

    uploadList.delegate('submit', function(ev) {
        Y.log('Form submission caught.', 'info');
        var form = ev.target;
        ev.preventDefault();
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
                ],
                on: {
                    success: function(id, resp) {
                        var container = form.ancestor('li');
                        if (container) {
                            container.remove();
                            container.destroy(true);
                        }
                    }
                }
            });
    }, "form");
});
