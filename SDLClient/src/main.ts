requirejs.config({
    baseUrl: 'src/dist',
    paths: {
        'jQuery': '../../bower_components/jquery/dist/jquery.min',
        'jQuery.ui': '../../bower_components/jquery-ui/jquery-ui.min',
    //    'tether':'../../bower_components/tether/dist/js/tether',
        'tether': '../tetherDef',
        'bootstrap': '../../bower_components/bootstrap/dist/js/bootstrap',
        'app': './sdlClientApp',
        'angular': '../../bower_components/angular/angular',
        'ngAnimate': '../../bower_components/angular-animate/angular-animate',
		'ui.router': '../../bower_components/angular-ui-router/release/angular-ui-router',
        'ui.bootstrap': '../../bower_components/angular-bootstrap/ui-bootstrap-tpls',
        'socketio': '../socket.io/socket.io'
    },
    shim: {
        'tether': ['jQuery'],
        'bootstrap': ['tether', 'jQuery'],
        'jQuery.ui': ['jQuery'],
		'app': ['angular'],
        'ngAnimate': ['angular'],
		'ui.router': ['angular'],
        'ui.bootstrap': ['angular']
    }

});

requirejs(['app', 'socketio', 'tether', 'jQuery', 'jQuery.ui', 'bootstrap', 'angular', 'ngAnimate', 'ui.router', 'ui.bootstrap'],
    (app, io) => {
    var client = new app.SDLClientApp(io);

    angular.element(document).ready(() => {
        angular.bootstrap(document, ['SDLClientApp']);
    });
});