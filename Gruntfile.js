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
		watch: {
			options: {
				livereload: true
			},
			html: {
				files: ['index.html']
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadNpmTasks('grunt-contrib-watch')

	grunt.registerTask('server', ['connect', 'watch']);
};