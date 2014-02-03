module.exports = function(grunt) {

	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadNpmTasks('grunt-open');
	grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks('grunt-shell');

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		meta:{
			version:'<%= pkg.version %>'
		},
		concat: {
            core: {
                src: [
                    'node_modules/infuse.js/src/infuse.js',
                    'node_modules/signals/dist/signals.js',
                    'src/01-prefix.js',
                    'src/02-utils.js',
                    'src/03-core.js',
                    'src/04-suffix.js'
                ],
                dest: 'build/calista.js'
            },
            nodeps: {
                src: [
                    'src/01-prefix.js',
                    'src/02-utils.js',
                    'src/03-core.js',
                    'src/04-suffix.js'
                ],
                dest: 'build/calista-nodeps.js'
            }
		},
		uglify: {
			options: {
				banner: '/* <%= pkg.name %> - v<%= pkg.version %> - ' + '<%= grunt.template.today("yyyy-mm-dd") %> */',
				mangle: false
			},
			my_target: {
				files: {
					'build/calista-v<%= meta.version %>.min.js': ['<%= concat.core.dest %>']
				}
			}
		},
		watch: {
            hold: {
                files:[
                    'src/*.js'
                ]
            },
			build: {
				files:[
                    'src/*.js',
					'GruntFile.js'
				],
				tasks:['concat', 'uglify']
			},
			tests: {
				files:[
                    'tests/**/*.js',
					'GruntFile.js'
				],
				tasks:['tests']
			}
		},
		jshint: {
	    	allFiles: [
	        	'build/calista-nodeps.js'
	      	],
	      	options: {
	        	jshintrc: '.jshintrc'
	      	}
	    },
        connect: {
            base: {
                options: {
                    base: './',
                    port: 8000
                }
            }
        },
        open: {
            tests: {
                path: 'http://localhost:8000/tests'
            }
        },
        karma: {
            unit_single: {
                configFile: 'karma.conf.js',
                runnerPort: 9999,
                singleRun: true,
                background: false,
                browsers: ['PhantomJS']
            },
            unit: {
                configFile: 'karma.conf.js',
                runnerPort: 9999,
                singleRun: false,
                background: false,
                browsers: ['PhantomJS']
            }
        }
	});

    grunt.registerTask('tests', ['karma:unit_single']);
    grunt.registerTask('tests:unit', ['karma:unit']);
    grunt.registerTask('tests:browser', ['connect:base', 'open:tests', 'watch:hold']);

	grunt.registerTask('default', ['concat', 'uglify', 'jshint', 'tests']);

};