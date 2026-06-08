
module.exports = (app, adminController, tokenController) => {
    // Admin routes
    app.get('/dashboard', adminController.getDashboard);
    app.get('/reset-queue', adminController.resetQueue);
    app.get('/call/:id', adminController.callToken);
    
   
    app.get('/complete/:id', (req, res) => {
        const db = req.app.get('db');
        db.query('UPDATE tokens SET status = "Completed" WHERE id = ?',
            [req.params.id], () => tokenController.callNextToken(res));
    });

    app.get('/decline/:id', (req, res) => {
        const db = req.app.get('db');
        db.query('UPDATE tokens SET status = "Declined" WHERE id = ?',
            [req.params.id], () => tokenController.callNextToken(res));
    });
};