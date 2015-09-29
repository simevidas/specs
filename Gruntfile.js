module.exports = function (grunt) {
	'use strict';

	grunt.initConfig({
		connect: {
			server: {
				options: {
					port: 9000
				}
			}
		},
        sass: {
            default: {
                options: {
                    'outputStyle': 'expanded'
                },
                files: {
                    'css/w3viewer.css': 'sass/w3viewer.sass'
                }
            }
        },
		watch: {
			options: {
				livereload: true
			},
			html: {
				files: ['index.html']
			},
            sass: {
                files: ['sass/*.sass'],
                tasks: ['sass:default']
            }
		}
	});

	grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-sass');

	grunt.registerTask('server', ['connect', 'watch']);
};