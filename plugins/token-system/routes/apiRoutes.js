// plugins/token-system/routes/apiRoutes.js
module.exports = (app, apiController) => {
    // ✅ FIXED: Status endpoint - React Native calls this
    app.get('/api/status', (req, res) => {
        apiController.getQueueStatus(req, res);
    });
    
    // ✅ FIXED: Generate token endpoint - React Native calls this
    app.post('/api/generate-token', (req, res) => {
        apiController.generateTokenAPI(req, res);
    });
    
    // Admin endpoints
    app.post('/api/toggle-pause', (req, res) => {
        apiController.togglePause(req, res);
    });
    
    app.get('/api/health', (req, res) => {
        res.json({ 
            status: 'online', 
            timestamp: new Date().toISOString() 
        });
    });
};