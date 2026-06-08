module.exports = (app, counterController) => {
    // Counter authentication routes
    app.get('/counter-login', counterController.getCounterLogin);
    app.post('/counter-login', counterController.postCounterLogin);
    
    app.get('/counter/:id', counterController.getCounterDashboard);
    app.get('/counter/:id/complete', counterController.completeCurrentToken);
    app.get('/counter/:id/call-next', counterController.callNextToken);
    app.get('/counter/:id/decline', counterController.declineToken);
    
    // Logout
  // Line 12 ko yeh se REPLACE karo:
const counterId = parseInt(req.params.id);

if (!req.session.loggedCounters || 
    !req.session.loggedCounters.includes(counterId)) {
    return res.redirect('/counter/login');
}
};