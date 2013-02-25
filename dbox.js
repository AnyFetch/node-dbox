var request = require("request")
var qs      = require("querystring")

var set_args = function (options, args) {
  for(var attr in args) {
    if (args.hasOwnProperty(attr)){
      options[attr] = args[attr];
    }
  }
  return options;
};

exports.app = function(config){
  var root   = config.root  || "sandbox"
  var helpers = require("./lib/helpers")(config)
 
  return {

    requesttoken: function(cb){
      var signature = helpers.sign({})
      var args = {
        "method": "POST",
        "headers": { "content-type": "application/x-www-form-urlencoded" },
        "url": "https://api.dropbox.com/1/oauth/request_token",
        "body": qs.stringify(signature)
      }
      return request(args, function(e, r, b){
        var obj = qs.parse(b)
        obj.authorize_url = "https://www.dropbox.com/1/oauth/authorize?oauth_token=" + obj.oauth_token
        cb(e ? null : r.statusCode, obj)
      })
    },

    accesstoken: function(options, cb){
      var params = helpers.sign(options)
      var args = {
        "method": "POST",
        "headers": { "content-type": "application/x-www-form-urlencoded" },
        "url": "https://api.dropbox.com/1/oauth/access_token",
        "body": qs.stringify(params)
      }
      return request(args, function(e, r, b){
        cb(e ? null : r.statusCode, qs.parse(b))
      })
    },

    // creates client object
    client: function(options){
      var options = options

      return {
        account: function(cb){
          var signature = helpers.sign(options)
          var args = {
            "method": "POST",
            "headers": { "content-type": "application/x-www-form-urlencoded" },
            "url": "https://api.dropbox.com/1/account/info",
            "body": qs.stringify(signature)
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : helpers.parseJSON(b))
          })
        },
        
        delta: function(args, callback){
          if(!cb){
            cb   = args
            args = null
          }
          
          var signature = helpers.sign(options, args)
          
          var args = {
            "method": "POST",
            "headers": { "content-type": "application/x-www-form-urlencoded" },
            "url": "https://api.dropbox.com/1/delta",
            "body": qs.stringify(body)
          }
          
          return request(args, function(e, r, b){
            var status = e ? null : r.statusCode
            var output = helpers.parseJSON(b)
            callback(status, output)
          })
        },

        get: function(path, args, cb){
          if(!cb){
            cb   = args
            args = null
          }
          
          var signature = helpers.sign(options, args)
          
          var url = helpers.url({
            hostname: "api-content.dropbox.com",
            action: "files",
            path: path,
            query: signature
          })

          var args = {
            "method": "GET",
            "url": url,
            "encoding": null
          }
          
          return request(args, function(e, r, b) {
            if (e) {
               cb(null, null, null);
            } else {
              var headers = (r.headers['x-dropbox-metadata'] !== undefined) ? helpers.parseJSON(r.headers['x-dropbox-metadata']) : {};
              cb(r.statusCode, b, headers);
            }
          })
        },

        stream: function(path, args) {          
          var signature = helpers.sign(options, args)
          
          var url = helpers.url({
            hostname: "api-content.dropbox.com",
            action: "files",
            path: path,
            query: signature
          })

          var args = {
            "method": "GET",
            "url": url,
            "encoding": null
          }

          return request(args);
        },        

        put: function(path, body, args, cb){
          if(!cb){
            cb   = args
            args = null
          }
          
          var signature = helpers.sign(options, args)

          var url = helpers.url({
            hostname: "api-content.dropbox.com",
            action: "files_put",
            path: path,
            query: signature
          })
          
          var args = {
            "method": "PUT",
            "headers": { "content-length": body.length },
            "url": url
          }
          
          // do not send empty body
          if(body.length > 0) args["body"] = body
          
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : helpers.parseJSON(b))
          })
        },

        metadata: function(path, args, cb){
          if(!cb){
            cb   = args
            args = null
          }
          
          var signature = helpers.sign(options, args)
          
          var url = helpers.url({
            hostname: "api.dropbox.com",
            action: "metadata",
            path: path,
            query: signature
          })
          
          var args = {
            "method": "GET",
            "url": url
          }
          
          return request(args, function(e, r, b){
            // this is a special case, since the dropbox api returns a
            // 304 response with an empty body when the 'hash' option
            // is provided and there have been no changes since the
            // hash was computed
            if (e) {
                cb(null, null)
            } else {
                cb(r.statusCode, r.statusCode == 304 ? {} : helpers.parseJSON(b))
            }
          })
        },

        //
        // Loads a dropbox folder
        // (recursive by default)
        //
        readdir: function (path, options, callback) {
          if (arguments.length < 3) {
            callback = options;
            options = options || {};
          }
          options.recursive = (options.recursive !== false);    // default true
          options.details = (options.details === true);         // default false

          var results = [],
          REQUEST_CONCURRENCY_DELAY = 200,
          callbacks = 0,
          self = this;
          //
          // Remark: REQUEST_CONCURRENCY_DELAY represents the millisecond,
          // delay between outgoing requests to dropbox
          //
          function load (path) {
            callbacks++;
            //
            // Give the dropbox API a delay between requests,
            // by wrapping each depth level in a setTimeout delay
            //
            setTimeout(function(){
              self.metadata(path, function (status, reply) {
                //
                // If we have found any contents on this level of the folder
                //
                if (reply.contents) {
                  reply.contents.forEach(function (item) {
                    //
                    // Add the item into our results array (details or path)
                    //
                    results.push(options.details ? item : item.path);
                    //
                    // If we have encountered another folder, we can recurse on it
                    //
                    if (item.is_dir && options.recursive) {
                      load(item.path);
                    }
                  });
                }
                callbacks--;
                if (callbacks === 0) {
                  callback(status, results);
                }
              });
            }, REQUEST_CONCURRENCY_DELAY)
          }
          load(path, results);
        },

        revisions: function(path, args, cb){
          if(!cb){
            cb   = args
            args = null
          }
          
          var signature = helpers.sign(options, args)
          
          var url = helpers.url({
            hostname: "api.dropbox.com",
            action: "revisions",
            path: path,
            query: signature
          })

          var args = {
            "method": "GET",
            "url": url
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : helpers.parseJSON(b))
          })
        },

        restore: function(path, rev, args, cb){
          if(!cb){
            cb   = args
            args = null
          }
          
          var signature    = helpers.sign(options, args)
          signature["rev"] = rev
          
          var url = helpers.url({
            hostname: "api.dropbox.com",
            action: "restore",
            path: path
          })

          var body = qs.stringify(signature)
          
          var args = {
            "method": "POST",
            "headers": {
              "content-type": "application/x-www-form-urlencoded",
              "content-length": body.length
            },
            "url": url,
            "body": body
          }
          
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : helpers.parseJSON(b))
          })
        },

        search: function(path, query, args, cb){
          
          if(!cb){
            cb   = args
            args = null
          }
          
          var signature = helpers.sign(options, args)
          signature["query"] = query
          
          var url = helpers.url({
            hostname: "api.dropbox.com",
            action: "search",
            path: path
          })

          var body = qs.stringify(signature)
          var args = {
            "method": "POST",
            "headers": {
              "content-type": "application/x-www-form-urlencoded",
              "content-length": body.length 
            },
            "url": url,
            "body": body
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : helpers.parseJSON(b))
          })
        },

        shares: function(path, args, cb){
          if(!cb){
            cb   = args
            args = null
          }
          
          var signature = helpers.sign(options, args)
          
          var url = helpers.url({
            hostname: "api.dropbox.com",
            action: "shares",
            path: path
          })
          
          var body = qs.stringify(signature)
          
          var args = {
            "method": "POST",
            "headers": {
              "content-type": "application/x-www-form-urlencoded",
              "content-length": body.length 
            },
            "url": url, 
            "body": body
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : helpers.parseJSON(b))
          })
        },

        media: function(path, args, cb){
          if(!cb){
            cb   = args
            args = null
          }
          
          var signature = helpers.sign(options, args)
          
          var url = helpers.url({
            hostname: "api.dropbox.com",
            action: "media",
            path: path
          })
          
          var body = qs.stringify(signature)
          
          var args = {
            "method": "POST",
            "headers": {
              "content-type": "application/x-www-form-urlencoded",
              "content-length": body.length 
            },
            "url": url,
            "body": body
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : helpers.parseJSON(b))
          })
        },

        cpref: function(path, args, cb){
          if(!cb){
            cb   = args
            args = null
          }
          
          var signature = helpers.sign(options, args)
          
          var url = helpers.url({
            hostname: "api.dropbox.com",
            action: "copy_ref",
            path: path,
            query: signature
          })
          
          var args = {
            "method": "GET",
            "url": url
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : helpers.parseJSON(b))
          })
        },

        thumbnails: function(path, args, cb){
          if(!cb){
            cb   = args
            args = null
          }
          
          var signature = helpers.sign(options, args)
          
          var url = helpers.url({
            hostname: "api-content.dropbox.com",
            action: "thumbnails",
            path: path,
            query: signature
          })

          var args = {
            "method": "GET",
            "url": url,
            "encoding": null
          }
          
          return request(args, function(e, r, b){
            if (e) {
                cb(null, null, null)
            } else {
                var headers = (r.headers['x-dropbox-metadata'] !== undefined) ? helpers.parseJSON(r.headers['x-dropbox-metadata']) : {};
                cb(r.statusCode, b, headers)
            }
          })
        },

        cp: function(from_path, to_path, args, cb){
          if(!cb){
            cb   = args
            args = null
          }

          var signature = helpers.sign(options, args)
          
          // check for copy ref
          if(from_path.hasOwnProperty("copy_ref")){
            signature['from_copy_ref'] = from_path["copy_ref"]
          }else{
            signature['from_path'] = from_path
          }
          
          signature["root"]    = root       // API quirk that this is reqired for this call
          signature["to_path"] = to_path
          
          
          var url = helpers.url({
            hostname: "api.dropbox.com",
            action: "fileops/copy"
          })
          
          var body = qs.stringify(signature)

          var args = {
            "method": "POST",
            "headers": { 
              "content-type": "application/x-www-form-urlencoded",
              "content-length": body.length
            },
            "url": url,
            "body": body
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : helpers.parseJSON(b))
          })
        },

        mv: function(from_path, to_path, args, cb){
          if(!cb){
            cb   = args
            args = null
          }

          var signature = helpers.sign(options, args)
          
          signature["root"]      = root          // API quirk that this is reqired for this call
          signature["from_path"] = from_path
          signature["to_path"]   = to_path
          
          var url = helpers.url({
            hostname: "api.dropbox.com",
            action: "fileops/move"
          })

          var body = qs.stringify(signature)
          
          var args = {
            "method": "POST",
            "headers": { 
              "content-type": "application/x-www-form-urlencoded",
              "content-length": body.length
            },
            "url": url,
            "body": body
          }

          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : helpers.parseJSON(b))
          })
        },

        rm: function(path, args, cb){
          if(!cb){
            cb   = args
            args = null
          }

          var signature = helpers.sign(options, args)
          
          signature["root"] = root
          signature["path"] = path
          
          var url = helpers.url({
            hostname: "api.dropbox.com",
            action: "fileops/delete"
          })
          
          var body = qs.stringify(signature)
          
          var args = {
            "method": "POST",
            "headers": { 
              "content-type": "application/x-www-form-urlencoded",
              "content-length": body.length
            },
            "url": url,
            "body": body
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : helpers.parseJSON(b))
          })
        },

        mkdir: function(path, args, cb){
          if(!cb){
            cb   = args
            args = null
          }

          var signature = helpers.sign(options, args)
          
          signature["root"] = root
          signature["path"] = path
          
          
          var url = helpers.url({
            hostname: "api.dropbox.com",
            action: "fileops/create_folder"
          })
          
          var body = qs.stringify(signature)
          
          var args = {
            "method": "POST",
            "headers": { 
              "content-type": "application/x-www-form-urlencoded",
              "content-length": body.length
            },
            "url": url,
            "body": body
          }
          return request(args, function(e, r, b){
            cb(e ? null : r.statusCode, e ? null : helpers.parseJSON(b))
          })
        }
      }
    }
  } 

}

