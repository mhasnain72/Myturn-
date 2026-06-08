
module.exports = (app, controller) => {
 
    app.get('/kiosk', controller.getKiosk);
    app.post('/generate-token', controller.generateToken);
    app.get('/token-success', controller.tokenSuccess);
    app.get('/toggle-pause', controller.togglePause);
};