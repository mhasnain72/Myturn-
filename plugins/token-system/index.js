// plugins/token-system/index.js
module.exports = {
    init: (app) => {
        console.log('🧩 Loading Token System Plugin...');
        
        const db = app.get('db');
        
        // Load controllers with db
        const tokenController = require('./controllers/tokenController')(db);
        const adminController = require('./controllers/adminController')(db);
        const apiController = require('./controllers/apiController')(db);
        
        // Load routes
        require('./routes/tokenRoutes')(app, tokenController);
        require('./routes/adminRoutes')(app, adminController, tokenController);
        require('./routes/apiRoutes')(app, apiController, tokenController);
        require('./routes/webRoutes')(app);
        
        console.log('✅ Token System Plugin Loaded Successfully');
    }
};