// plugins/token-system/controllers/adminController.js
module.exports = (db, tokenController) => {
    return {
        getDashboard: (req, res) => {
            const isPaused = tokenController ? tokenController.getPauseState() : false;
            
            // Get active tokens
            db.query(
                `SELECT t.* 
                 FROM tokens t
                 WHERE t.status NOT IN ("Completed", "Declined") 
                 ORDER BY 
                     CASE WHEN t.status = 'Calling' THEN 1 ELSE 2 END,
                     t.token_number ASC`,
                (err, activeResults) => {

                // Get history tokens
                db.query(
                    `SELECT t.* 
                     FROM tokens t
                     WHERE t.status IN ("Completed", "Declined") 
                     ORDER BY t.id DESC LIMIT 50`,
                    (err, historyResults) => {
                        
                    res.render('dashboard', {
                        isPaused: isPaused,
                        activeTokens: activeResults || [],
                        history: historyResults || [],
                        counters: [],
                        stats: { waiting: 0, calling: 0, completed: 0, declined: 0 },
                        currentTime: new Date().toLocaleTimeString()
                    });
                });
            });
        },

        resetQueue: (req, res) => {
            db.query('TRUNCATE TABLE tokens', () => {
                res.redirect('/dashboard');
            });
        },

        callToken: (req, res) => {
            const tokenId = req.params.id;
            
            db.query('UPDATE tokens SET status = "Waiting" WHERE status = "Calling"', () => {
                db.query('UPDATE tokens SET status = "Calling" WHERE id = ?', 
                    [tokenId], 
                    () => res.redirect('/dashboard')
                );
            });
        }
    };
};