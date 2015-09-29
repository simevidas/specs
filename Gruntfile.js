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
                    'styles/w3viewer.css': 'styles/w3viewer.sass'
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
                files: ['styles/*.sass'],
                tasks: ['sass:default']
            }
		}
	});

	grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-sass');

	grunt.registerTask('server', ['connect', 'watch']);
};