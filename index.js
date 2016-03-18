var express = require('express');
var path = require('path');
var fs = require('fs');
var https = require('https');
//var http = require('http');
var wav = require('wav');
var sox = require('sox');
var SoxCommand = require('sox-audio');
var ss = require('socket.io-stream');
var config = require('./config/mixidea.conf');
var Firebase = require("firebase");

var log4js = require('log4js');
log4js.configure({
    appenders: [
        {
            "type": "dateFile",
            "category": "request",
            "filename": "logs/request.log",
            "pattern": "-yyyy-MM-dd"            
        },

    ]
});
var loggerRequest = log4js.getLogger('request');


var AWS = require('aws-sdk');
AWS.config.update({accessKeyId: config.AwsKeyId, secretAccessKey: config.SecretKey});
s3 = new AWS.S3({params: {Bucket:config.BucketName} });


var credentials = {
  key: fs.readFileSync('./cert/mixidea.key'),
  cert: fs.readFileSync('./cert/mixidea.cert')
};

var app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'node_modules/socket.io-client/')));
app.use(express.static(path.join(__dirname, 'node_modules/socket.io-stream/')));
app.use(express.static(path.join(__dirname, 'logs')));


app.get('/', function (req, res) {
  res.send('Hello World!');
});


var httpServer = https.createServer(credentials, app);
//var httpServer = http.createServer(app);

var serverPort = 3000;
var server = httpServer.listen(serverPort, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Example app listening at http://%s:%s', host, port);
});


var io = require('socket.io').listen(server);
io.sockets.setMaxListeners(Infinity);



(function(){

  var self = this;
  self.io_namespace = io.of("/");
  var GlobalInfo = new Object();

	self.io_namespace.on('connection', function(socket){

		console.log("connect socket id=" + socket.id);
		loggerRequest.info("connect socket id=" + socket.id);
		socket.setMaxListeners(Infinity);

		socket.on('disconnect', function(){
			console.log("user disconnected socket id=" + socket.id);
			loggerRequest.info("user disconnected socket id=" + socket.id);
		});

		socket.on('join_room', function(data){
			socket.join(data.room_name);
			console.log('user join in the name room: ' + data.room_name + ", socketid is " + socket.id);
			loggerRequest.info('user join in the name room: ' + data.room_name + ", socketid is " + socket.id);
		});

		ss(socket).on('audio_record_start', function(stream, data){
			console.log("audio record start socket id=" + socket.id);
			loggerRequest.info("audio record start socket id=" + socket.id);
			stream.setMaxListeners(Infinity);
			var outfile_name  = data.filename;
			outfile_name = outfile_name.replace(/-/g, "");
			var record_start_time = Date.now();
			console.log("audio record start at " + record_start_time + " socketid:" + socket.id);
			loggerRequest.info("audio record start at " + record_start_time + " socketid:" + socket.id);

			var sample_rate = data.sample_rate || 44100;
			eval("GlobalInfo.file_writer_count_" + outfile_name + "=1");
			eval("GlobalInfo.record_start_time_" + outfile_name + "=" + record_start_time);
			var outfile_name_wav  = './public/audio/' + outfile_name + "_1.wav";
			console.log("output file name is " + outfile_name_wav);
			loggerRequest.info("output file name is " + outfile_name_wav);

			var file_writer = new wav.FileWriter(
			 outfile_name_wav,
			 {channels:1,
			  sampleRate:sample_rate,
			  bitDepth:16}
			);
			stream.pipe(file_writer);
		});

		ss(socket).on('audio_record_resume', function(stream, data){
			console.log("audio record resume " + socket.id);
			loggerRequest.info("audio record resume " + socket.id);

			var outfile_name  = data.filename;
			outfile_name = outfile_name.replace(/-/g, "");
			var prev_count = eval("GlobalInfo.file_writer_count_" + outfile_name );
			if(!prev_count){
				return;
			}
			var next_count = prev_count + 1;
			console.log("resume count is " + next_count);
			loggerRequest.info("resume count is " + next_count);
			var sample_rate = data.sample_rate || 44100;

			eval("GlobalInfo.file_writer_count_" + outfile_name + "=next_count");
			var outfile_name_wav  = './public/audio/' +  outfile_name + "_" + String(next_count)  + ".wav";
			console.log("output file name is " + outfile_name_wav);
			loggerRequest.info("output file name is " + outfile_name_wav);

			var file_writer = new wav.FileWriter(
				 outfile_name_wav, 
				 {channels:1,
				  sampleRate:sample_rate,
				  bitDepth:16}
			);
			stream.pipe(file_writer);

		});

/*
		socket.on('test', function(data){
			console.log("test" +  data);
			console.log(socket.id);
		});

		ss(socket).on('profile-image', function(stream, data) {
			var filename = path.basename(data.name);
			 console.log(socket.id);
			console.log("profile image recieve " + filename);
			stream.pipe(fs.createWriteStream(filename));
		});
*/


		socket.on('audio_record_suspend', function(data){
			console.log("audio suspend " + socket.id);
			loggerRequest.info("audio suspend " + socket.id);
		});

		socket.on('audio_record_end', function(data){
			console.log("audio record end socket id=" + socket.id);
			loggerRequest.info("audio recording end " + socket.id);
			var outfile_name  = data.filename;
			outfile_name = outfile_name.replace(/-/g, "");
			var role_name  = data.role_name;
			var room_name = data.room_name;
			var speech_id_val = data.speech_id;
			console.log("file name is " + outfile_name);
			loggerRequest.info("file name is " + outfile_name);
			console.log("role name is " + role_name);
			loggerRequest.info("role name is " + role_name);

			var record_start_time = eval("GlobalInfo.record_start_time_" + outfile_name);
			var audio_record_end_time = Date.now();
			var record_duration = audio_record_end_time - record_start_time;
			var count = eval("GlobalInfo.file_writer_count_" + outfile_name );
			console.log("audio record start " + record_start_time);
			loggerRequest.info("audio record start " + record_start_time);
			console.log("audio record end " + audio_record_end_time);
			loggerRequest.info("audio record end " + audio_record_end_time);
			console.log("recording duration is " + record_duration + " msec");
			loggerRequest.info("recording duration is " + record_duration + " msec");
			console.log("file count is " + count );
			loggerRequest.info("file count is " + count );
			eval(" delete GlobalInfo.file_writer_count_" + outfile_name );
			eval(" delete GlobalInfo.record_start_time_" + outfile_name );
			setTimeout(function(){
				convert_SampleRate_transcode_upload_S3(outfile_name, count,  role_name, room_name, speech_id_val);

			}, record_duration);
		});
	});


var convert_SampleRate_transcode_upload_S3 = function(outfile_name, count, role_name , room_name, speech_id_val)
{
	console.log("convert_SampleRate_transcode_upload_S3 start");
	loggerRequest.info("convert_SampleRate_transcode_upload_S3 start");
	var file_list_len = count;
	for(var i=0; i< file_list_len; i++){
		convert_sample_rate( outfile_name, i);
	}
	setTimeout(function(){
		transcode_file_upload_s3_command(outfile_name, count, role_name, room_name, speech_id_val);
	}, 10000);
}

var convert_sample_rate = function( outfile_name, i){
	var existing_file_name = './public/audio/' + outfile_name + "_"+ String(i+1) + '.wav';
	var dest_file = './public/audio/' + outfile_name + "_"+ String(i+1) + "_convert.wav";
	console.log("convert:" + existing_file_name);
	loggerRequest.info("convert:" + existing_file_name);
	var wstream = fs.createWriteStream(dest_file);
	var command = SoxCommand().output(wstream).outputFileType('wav').outputSampleRate(44100);
	command.input(existing_file_name);
	command.on('end', function() {
		console.log("changing sample rate succeed:" + dest_file);
		loggerRequest.info("changing sample rate succeed:" + dest_file);
	});
	command.on('error', function(err, stdout, stderr) {
		console.log("changing sample rate fail" + err + ":" + outfile_name);
		loggerRequest.info("changing sample rate fail" + err + ":" + outfile_name);
	});
	command.run();
}


var transcode_file_upload_s3_command = function(file_name, count,  role_name , room_name, speech_id_val)
{
  console.log("transcode command is called");
	loggerRequest.info("transcode command is called");
	var dest_file = './public/audio/' + file_name + '.mp3';
	var file_name_on_s3 = file_name + '.mp3';
	var wstream = fs.createWriteStream(dest_file);
	var command = SoxCommand().output(wstream).outputFileType('mp3');

	var source_file_list = new Array();
	var file_list_len = count;
	for(var i=0; i< file_list_len; i++){
		var each_file_name = './public/audio/' + file_name + "_"+ String(i+1) + "_convert.wav";
		console.log(each_file_name);
		loggerRequest.info(each_file_name);
		command.input(each_file_name);
	}

	command.on('progress', function(progress) {
	  console.log('Processing progress: ', progress);
		loggerRequest.info('Processing progress: ', progress);
	});
	 
	command.on('error', function(err, stdout, stderr) {
	  console.log('transcode and connecting audio failed: ' + err);
		loggerRequest.info('transcode and connecting audio failed: ' + err);
	});
	 
	command.on('end', function() {
		console.log('transcode and connecting audio succeeded!');
		loggerRequest.info('transcode and connecting audio succeeded!');
		wstream.end();
		fs.readFile(dest_file, function (err, data) {
			s3.putObject(
				{Key: file_name_on_s3, ContentType: "audio/mp3", Body: data, ACL: "public-read"},
				function(error, data){
					if(data !==null){
						console.log("succeed to save data on S3");
						loggerRequest.info("succeed to save data on S3");

						save_AudioInfo_onFirebase(file_name_on_s3,  role_name, room_name, speech_id_val);

					}else{
						console.log("fai to save data on S3" + error + data);
						loggerRequest.info("fai to save data on S3" + error + data);
					}
				}
			);
		});

	});
	command.run();
}

var save_AudioInfo_onFirebase = function(file_name, role_name, room_name, speech_id_val)
{

	var audio_url = config.S3_audio_url + config.BucketName + "/" + file_name;
	console.log("audio url: " + audio_url);
	loggerRequest.info("audio url: " + audio_url);
	

	var event_id = room_name;
    var root_ref = new Firebase(config.firebase_url);
    var child_path = "event_related/audio_transcript/" +event_id + "/" + role_name + "/" + speech_id_val + "/audio";
    console.log(child_path)
    var audio_file_ref = root_ref.child(child_path);
    audio_file_ref.set(audio_url, function(error) {
		if (error) {
			console.log("saving file on firabase failed" + error + "event id " + event_id);
		} else {
			console.log("saving file on firebase succeedevent id " + event_id);
		}
	});



}




} ());








