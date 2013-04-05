var path = require('path'),
	os = require('os'),
	util = require('util'),
	fs = require('fs'),
	appc = require('node-appc'),
    afs = appc.fs,
    wrench = require('wrench'),
	exec = require('child_process').exec,
	lastLineCount = 0;

var findNDK = function() {

	var default_dirs;
	var ndkPath = 'not found';

	if (process.platform === 'win32') {
		default_dirs = ['C:\\bbndk']
	}
	else {
		default_dirs = ['/Applications/bbndk', '/Developer/SDKs/bbndk', '/opt/bbndk', '~/bbndk', '~/opt/bbndk']
	}

	var len = default_dirs.length;

	for (i = 0; i < len; i++) {
		if (fs.existsSync(default_dirs[i])) {
			return default_dirs[i];
	     }
	}
}

var generateTmpName = function(suffix) {

	var now = new Date();
	var name = [	now.getYear(), now.getMonth(), now.getDate(),
				'-',
				process.pid,
				'-',
				(Math.random() * 0x100000000 + 1).toString(36),
				'-',
				suffix
	          ].join('');
	return name;
}

var runCommandFromArray = function(commandArray, callback) {

    var len = commandArray.length;
    var command = '';
	for (i = 0; i < len; i++) {
		command += commandArray[i] + ' ';
	}

	console.log('[Command] :' + command);

	exec(command, function(err, stdout) {

		callback(err, stdout);
	    if (err != null) {
			util.puts(err);
		}
		if (stdout != null) {
			util.puts(stdout.trim());
	    }
	});	
}

var renderTemplate = function(template, props) {
	return template.replace(/\$\{([^\:\}]+)(?:\:([^\s\:\}]+))?\}/g, function (match, key, format) {
		var parts = key.trim().split('|').map(function (s) { return s.trim(); });
		key = parts[0];
		var value = '' + (props.hasOwnProperty(key) ? props[key] : 'null');
		if (parts.length > 1) {
			parts[1].split(',').forEach(function (cmd) {
				if (cmd == 'h') {
					value = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
				} else if (cmd == 'trim') {
					value = value.trim();
				} else if (cmd == 'jsQuoteEscapeFilter') {
					value = value.replace(/"/g, '\\"').replace(/\n/g, '\\n');
				}
			});
		}
		return value;
	});
}

var package = function(builder) {

    var projectDir = builder.projectDir;
	var buildDir = path.join(projectDir, 'build', 'blackberry');
    var titaniumBBSdkPath = builder.titaniumBBSdkPath;

    // copy over bootstrap files
	afs.copyDirSyncRecursive(path.join(titaniumBBSdkPath, 'tibb', 'titanium', 'javascript'),
	 									path.join(buildDir, 'framework'), { preserve: true, logger: logger.debug });

    // copy resources into assets folder
    var assetsDir = path.join(buildDir, 'assets');
	var resourcesDir = path.join(projectDir, 'Resources');

	afs.copyDirSyncRecursive(resourcesDir, assetsDir, { preserve: true, logger: logger.debug });

    var iphoneRes = path.join(assetsDir, 'iphone');
    var mobilewebRes = path.join(assetsDir, 'mobileweb');
    var androidRes = path.join(assetsDir, 'android');
    var blackberryRes = path.join(assetsDir, 'blackberry');
	if (fs.existsSync(iphoneRes)) { wrench.rmdirSyncRecursive(iphoneRes); }
	if (fs.existsSync(mobilewebRes)) { wrench.rmdirSyncRecursive(mobilewebRes); }
	if (fs.existsSync(androidRes)) { wrench.rmdirSyncRecursive(androidRes); }
    // blackberry resources start at assets
	if (fs.existsSync(blackberryRes)) { wrench.rmdirSyncRecursive(blackberryRes); }

	afs.copyDirSyncRecursive(path.join(resourcesDir, 'blackberry'),
	 									path.join(buildDir, 'assets'), { preserve: true, logger: logger.debug });

	var appPropsFile = path.join(buildDir, 'assets', 'app_properties.ini');
    fs.writeFileSync(appPropsFile, builder.appProps);
}

var sleep = function(delay) {
    var start = new Date().getTime();
    while (new Date().getTime() < start + delay);
}

var  isAppRunning = function(ndk, deviceIP, barFile, password, callback) {

	// setup the build environment and then run the ndk command
    var srccmd;
    var ndkcmd;
    if (process.platform === 'win32') {
    	srccmd = path.join(ndk, 'bbndk-env.bat');
		ndkcmd = 'blackberry-deploy.bat';
	} else {
		srccmd = 'source ' + path.join(ndk, 'bbndk-env.sh');
		ndkcmd = 'blackberry-deploy';
	}

	var command = [srccmd, '&&', ndkcmd, '-isAppRunning', '-device', deviceIP, '-package', barFile];

	if (typeof password !== 'undefined') {
		command.concat(['-password', password])
	}

	runCommandFromArray(command, function(err, stdout) { 
		console.log('kkkkk: ' + stdout.trim());
	   if (stdout.trim().indexOf('result::true') !== -1) {
           callback(true);
	   } else {
	   	   callback(false);
	   }
	});
}

var printAppLog = function(ndk, deviceIP, barFile, password, callback) {

	// setup the build environment and then run the ndk command
    var srccmd;
    var ndkcmd;
    if (process.platform === 'win32') {
    	srccmd = path.join(ndk, 'bbndk-env.bat');
		ndkcmd = 'blackberry-deploy.bat';
	} else {
		srccmd = 'source ' + path.join(ndk, 'bbndk-env.sh');
		ndkcmd = 'blackberry-deploy';
	}

	var hostFile = "-";
	var deviceFile = "logs/log";
	var command = [srccmd, '&&', ndkcmd, '-getFile', deviceFile, hostFile, '-device', deviceIP, '-package', barFile];

	if (typeof password !== 'undefined') {
		command.concat(['-password', password])
	}

	runCommandFromArray(command, function(err, stdout) {                       
		console.log('kkkkk' + stdout.trim());

		/*
		output = subprocess.check_output(command)
		output = output.split('\n')

		for k in range (len(output)):
			if k > self.lastLineCount:
				print output[k]
				self.lastLineCount = k
	*/


	});
}

var getAppLog = function(ndk, deviceIP, barFile, password, callback) {

	// setup the build environment and then run the ndk command
    var srccmd;
    var ndkcmd;
    if (process.platform === 'win32') {
    	srccmd = path.join(ndk, 'bbndk-env.bat');
		ndkcmd = 'blackberry-deploy.bat';
	} else {
		srccmd = 'source ' + path.join(ndk, 'bbndk-env.sh');
		ndkcmd = 'blackberry-deploy';
	}

	var hostFile = "-";
	var deviceFile = "logs/log";
	var command = [srccmd, '&&', ndkcmd, '-getFile', deviceFile, hostFile, '-device', deviceIP, '-package', barFile];

	if (typeof password !== 'undefined') {
		command.concat(['-password', password])
	}

	runCommandFromArray(command, function(err, stdout) {                       
		console.log('kkkkk' + stdout.trim());

		/*
		output = subprocess.check_output(command)
		output = output.split('\n')

		for k in range (len(output)):
			if k > self.lastLineCount:
				print output[k]
				self.lastLineCount = k
	*/


	});

	console.log('shdhsiudhsiuhisuhsdiusdhidsuhsi' + deviceIP);
}

function BlackberryNDK(builder) {
	
	var self =  { 

        builder: builder,

		build: function (finished) {

            var builder = this.builder;
            var logger = builder.logger;
			var ndk = builder.ndk;
			if (typeof ndk === 'undefined') {
		        ndk = findNDK();
		        if (typeof ndk === 'undefined') {
		        	return  1;
		        }
	    	}
	        logger.log('\n' + 'Path to BlackBerry NDK is: ' + ndk.cyan);

	        // BB NDK makefiles do not allow spaces in path names and cause build problem.
			// The solution is to use python temporary directories without spaces to do builds.
			var tmpPathSDK = path.join(os.tmpDir(), generateTmpName(builder.projectName));

			afs.copyDirSyncRecursive(path.join(builder.titaniumBBSdkPath, 'tibb'),
								path.join(tmpPathSDK, 'tibb'), {logger: logger.debug});
			afs.copyDirSyncRecursive(path.join(this.builder.titaniumBBSdkPath, 'libv8'),
								path.join(tmpPathSDK, 'libv8'), {logger: logger.debug});
							

			var variant = builder.type2variantCpu[this.builder.target][0];
			var cpu = builder.type2variantCpu[this.builder.target][1];

			var tiappName = 'TIAPP_NAME=' + builder.projectName;
			var cpuList = 'CPULIST=' + cpu;
			var bbRoot = 'BB_ROOT=' + tmpPathSDK;
			var debug = 'VARIANTLIST=';
			if (variant.indexOf('-g', variant.length - 2) !== -1) {
				debug += 'g';
			} 

			var oldPath = process.cwd()	
			var tmpPathProj = path.join(os.tmpDir(), generateTmpName(builder.projectName));
			var projectDir = this.builder.projectDir;
			afs.copyDirSyncRecursive(projectDir, tmpPathProj, {logger: logger.debug});
			process.chdir(path.join(tmpPathProj, 'build', 'blackberry'));

			// setup the build environment and then build the app executable using make
			var srccmd;
			if (process.platform === 'win32') {
				srccmd = path.join(ndk, 'bbndk-env.bat');
			} else {
				srccmd = 'source ' + path.join(ndk, 'bbndk-env.sh');
			}

			runCommandFromArray([srccmd, '&&', 'make', tiappName, cpuList, bbRoot, debug], function() {
				afs.copyDirSyncRecursive(tmpPathProj, projectDir, {logger: logger.debug});

				try {
					wrench.rmdirSyncRecursive(tmpPathSDK);
					wrench.rmdirSyncRecursive(tmpPathProj);
				}
				catch(e) {
					logger.log('\nUnable to remove temporary folders: ' + e);
				}
                
				process.chdir(oldPath);
				finished(/* if there was an error, pass it to finished */);
			});		
        },

        run: function (finished) {

        	var builder = this.builder;
            var logger = builder.logger;
			var ndk = builder.ndk;
			var deviceIP = builder.deviceIP;
        	if (typeof ndk === 'undefined') {
		        ndk = findNDK();
		        if (typeof ndk === 'undefined') {
		        	return  1;
		        }
	    	}
	        logger.log('\n' + 'Path to BlackBerry NDK is: ' + ndk.cyan);

			// write the bar-descriptor file
            var permissions = '';
            var tiapp = builder.tiapp;
            if (typeof tiapp.blackberry !== 'undefined' && typeof tiapp.blackberry.permissions !== 'undefined') {
	            for (key in tiapp.blackberry.permissions) {
	            	permissions += '<action>' + key + '</action>\n\t';
	        	}
	        }
            
        	var autoOrient = false;
        	var orientation = '';
        	if (typeof tiapp.blackberry !== 'undefined' && typeof tiapp.blackberry.orientation !== 'undefined') {
	        	orientation = builder.tiapp.blackberry.orientation['orientation'];
	        	if (orientation === 'auto') {
	        		autoOrient = true;
	        	}
	        }

            var projectDir = builder.projectDir;
            var buildDir = path.join(projectDir, 'build', 'blackberry');
			var barDescriptor = path.join(buildDir, 'bar-descriptor.xml');
			var barDescriptorTmpl = path.join(builder.titaniumBBSdkPath, 'templates', 'bar-descriptor2.xml');
			fs.writeFileSync(barDescriptor, renderTemplate(fs.readFileSync(barDescriptorTmpl).toString().trim(), {
				id: tiapp['id'] || '',
				appname: tiapp.name || '',
				description: tiapp.description || 'not specified',
				version: tiapp.version || '1.0',
				author: tiapp.publisher || 'not specified',
				autoOrient: autoOrient,
				orientation: orientation, 
				category: 'core.games',
				permissions: permissions || '',
				icon: 'assets/' + tiapp.icon || 'assets/appicon.png'
			}));

			// write app_properties.ini file 
			builder.appProps = '[General]\n';
			for (key in tiapp.properties) {
	            for (key2 in tiapp.properties[key]) {
	                if (key2 == 'value') {
	                    appProps += key + ' = ' + tiapp.properties[key][key2] + '\n';
	                }
	            }
	        }
		
            // create the bar package
            package(builder);

            // setup the build environment and then run the ndk command
            var srccmd;
            var ndkcmd;
            if (process.platform === 'win32') {
            	srccmd = path.join(ndk, 'bbndk-env.bat');
				ndkcmd = 'blackberry-nativepackager.bat';
			} else {
				srccmd = 'source ' + path.join(ndk, 'bbndk-env.sh');
				ndkcmd = 'blackberry-nativepackager';
			}

			var variant = builder.type2variantCpu[builder.target][0];
        	var cpu = builder.type2variantCpu[builder.target][1];
        	var projectName = builder.projectName;
        	var barFile = path.join(buildDir, cpu, variant, projectName + '.bar');
        	var appBinaryFile = path.join(buildDir, cpu, variant, projectName);
        	var type = builder.target;
        	var debugToken = builder.debugToken;
			
			// BuildID is is a 0-65535 value that identifies this package it must be incremented before bar signing 
			var buildID = 1;
        	if (typeof tiapp.blackberry !== 'undefined' && typeof tiapp.blackberry.buildID !== 'undefined') {
	        	buildID = builder.tiapp.blackberry.buildID['buildID'];
	        }

            var command = [srccmd, '&&', ndkcmd, '-package', barFile, 'bar-descriptor.xml', '-e', appBinaryFile , projectName, 
                                           '-buildID', buildID, 'assets', 'framework'];

            if (type !== 'distribute') {
				command.push('-devMode');
			}

			if (typeof debugToken !== 'undefined') {
				command.concat(['-debugToken', debugToken])
			}
             
            var oldPath = process.cwd();
            process.chdir(buildDir);	
            runCommandFromArray(command, function() {  

            	if (type !== 'distribute') {                      

		            if (process.platform === 'win32') {
						ndkcmd = 'blackberry-deploy.bat';
					} else {
						ndkcmd = 'blackberry-deploy';
					}

					command = [srccmd, '&&', ndkcmd, '-installApp', '-launchApp', '-device', deviceIP, '-package', barFile];

					if (typeof password !== 'undefined') {
						command.concat(['-password', password])
					}

					runCommandFromArray(command, function() {  
						setInterval(getAppLog, 2000, ndk, deviceIP, barFile, password, finished);                     
					});

	            } else {

	            	if (process.platform === 'win32') {
						ndkcmd = 'blackberry-signer.bat';
					} else {
						ndkcmd = 'blackberry-signer';
					}

                    var signedBarFile = appBinaryFile + '.bar'; // path with cpu and variant
					command = [srccmd, '&&', ndkcmd, '-storepass', builder.keystorePassword, signedBarFile];

					runCommandFromArray(command, function() { 

						if (typeof builder.outputDir !== 'undefined') {
                        	fs.mkDir(signedBarFile);           
                        	fs.createReadStream(signedBarFile).pipe(fs.createWriteStream(path.join(signedBarFile, projectName + '.bar')));
						
						}      

						process.chdir(oldPath);
						finished(/* if there was an error, pass it to finished */);
					});
	            }
			});		
        } // end of run function
	};

	return self;
};

module.exports = BlackberryNDK;

