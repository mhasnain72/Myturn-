// counterController.js
module.exports = (db) => {

    let isPaused = false;

    // ================================
    // Helper: Check Active Token
    // ================================
    const hasActiveToken = (counterId, callback) => {
        db.query(
            `SELECT id FROM tokens 
             WHERE assigned_counter = ? 
             AND status IN ('Calling', 'Serving') 
             LIMIT 1`,
            [counterId],
            (err, results) => {
                if (err) return callback(err);
                callback(null, results.length > 0);
            }
        );
    };

    // ================================
    // Helper: Assign Next Token
    // ================================
    const assignNextTokenToCounter = (counterId, callback) => {

        if (isPaused) return callback(null, null);

        db.query(
            `SELECT id, token_number 
             FROM tokens 
             WHERE status = 'Waiting' 
             AND assigned_counter IS NULL
             ORDER BY token_number ASC 
             LIMIT 1`,
            (err, nextToken) => {

                if (err) return callback(err);

                if (nextToken.length > 0) {

                    db.query(
                        `UPDATE tokens 
                         SET assigned_counter = ?, 
                             status = 'Calling',
                             served_at = NOW()
                         WHERE id = ?`,
                        [counterId, nextToken[0].id],
                        (updateErr) => {
                            if (updateErr) return callback(updateErr);

                            console.log(`✅ ASSIGNED: Token #${nextToken[0].token_number} → Counter ${counterId}`);
                            callback(null, nextToken[0]);
                        }
                    );

                } else {
                    console.log(`📭 No tokens available for Counter ${counterId}`);
                    callback(null, null);
                }
            }
        );
    };

    // ================================
    // EXPORT CONTROLLER METHODS
    // ================================
    return {

        // ================================
        // Login Page
        // ================================
        getCounterLogin: (req, res) => {
            res.render('counter-login', { error: null });
        },

        // ================================
        // Handle Login (MULTI COUNTER FIX)
        // ================================
        postCounterLogin: (req, res) => {

            const { login_id, password } = req.body;

            db.query(
                `SELECT * FROM counters 
                 WHERE login_id = ? 
                 AND login_password = ? 
                 AND is_active = true`,
                [login_id, password],
                (err, results) => {

                    if (err) {
                        console.error("Database error:", err);
                        return res.render('counter-login', { error: 'Database error' });
                    }

                    if (results.length === 0) {
                        return res.render('counter-login', {
                            error: 'Invalid credentials or counter inactive'
                        });
                    }

                    const counter = results[0];

                    // ✅ MULTI LOGIN SUPPORT
                    if (!req.session.loggedCounters) {
                        req.session.loggedCounters = [];
                    }

                    if (!req.session.loggedCounters.includes(counter.id)) {
                        req.session.loggedCounters.push(counter.id);
                    }

                    console.log(`✅ Counter ${counter.counter_number} logged in`);

                    res.redirect(`/counter/${counter.id}`);
                }
            );
        },

        // ================================
        // Dashboard (SESSION SAFE)
        // ================================
        getCounterDashboard: (req, res) => {

            const counterId = parseInt(req.params.id);

            if (!req.session.loggedCounters ||
                !req.session.loggedCounters.includes(counterId)) {

                console.log("❌ Unauthorized access attempt");
                return res.redirect('/counter-login');
            }

            db.query(
                'SELECT * FROM counters WHERE id = ?',
                [counterId],
                (err, counterData) => {

                    if (err || counterData.length === 0) {
                        return res.redirect('/counter-login');
                    }

                    db.query(
                        `SELECT t.*, 
                                TIMESTAMPDIFF(MINUTE, t.created_at, NOW()) as wait_time
                         FROM tokens t
                         WHERE t.assigned_counter = ? 
                         AND t.status IN ('Calling', 'Serving')
                         ORDER BY t.served_at DESC LIMIT 1`,
                        [counterId],
                        (err, currentToken) => {

                            db.query(
                                `SELECT t.*, 
                                        TIMESTAMPDIFF(MINUTE, t.created_at, NOW()) as wait_time
                                 FROM tokens t
                                 WHERE t.status = 'Waiting' 
                                 AND t.assigned_counter IS NULL
                                 ORDER BY t.token_number ASC LIMIT 10`,
                                (err, waitingTokens) => {

                                    db.query(
                                        `SELECT COUNT(*) as total_waiting 
                                         FROM tokens 
                                         WHERE status = 'Waiting'`,
                                        (err, countResult) => {

                                            res.render('counter-dashboard', {
                                                counter: counterData[0],
                                                currentToken: currentToken[0] || null,
                                                waitingTokens: waitingTokens || [],
                                                totalWaiting: countResult[0]?.total_waiting || 0,
                                                isPaused
                                            });

                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        },

        // ================================
        // Call Next Token
        // ================================
        callNextToken: (req, res) => {

            const counterId = parseInt(req.params.id);

            if (!req.session.loggedCounters ||
                !req.session.loggedCounters.includes(counterId)) {
                return res.redirect('/counter-login');
            }

            hasActiveToken(counterId, (err, hasToken) => {

                if (hasToken) {

                    db.query(
                        `UPDATE tokens 
                         SET status = 'Declined', 
                             completed_at = NOW(),
                             assigned_counter = NULL
                         WHERE assigned_counter = ? 
                         AND status IN ('Calling', 'Serving')`,
                        [counterId],
                        () => {
                            assignNextTokenToCounter(counterId, () => {
                                res.redirect(`/counter/${counterId}`);
                            });
                        }
                    );

                } else {

                    assignNextTokenToCounter(counterId, () => {
                        res.redirect(`/counter/${counterId}`);
                    });

                }
            });
        },

        // ================================
        // Complete Token
        // ================================
        completeCurrentToken: (req, res) => {

            const counterId = parseInt(req.params.id);

            db.query(
                `UPDATE tokens 
                 SET status = 'Completed', 
                     completed_at = NOW(),
                     assigned_counter = NULL
                 WHERE assigned_counter = ? 
                 AND status IN ('Calling', 'Serving')`,
                [counterId],
                () => {

                    assignNextTokenToCounter(counterId, () => {
                        res.redirect(`/counter/${counterId}`);
                    });

                }
            );
        },

        // ================================
        // Decline Token
        // ================================
        declineToken: (req, res) => {

            const counterId = parseInt(req.params.id);

            db.query(
                `UPDATE tokens 
                 SET status = 'Declined', 
                     completed_at = NOW(),
                     assigned_counter = NULL
                 WHERE assigned_counter = ? 
                 AND status IN ('Calling', 'Serving')`,
                [counterId],
                () => {

                    assignNextTokenToCounter(counterId, () => {
                        res.redirect(`/counter/${counterId}`);
                    });

                }
            );
        },

        // ================================
        // Logout Counter (MULTI SAFE)
        // ================================
        logoutCounter: (req, res) => {

            const counterId = parseInt(req.params.id);

            if (req.session.loggedCounters) {
                req.session.loggedCounters =
                    req.session.loggedCounters.filter(id => id !== counterId);
            }

            if (!req.session.loggedCounters ||
                req.session.loggedCounters.length === 0) {
                req.session.destroy();
            }

            res.redirect('/counter-login');
        },

        // ================================
        // Pause System
        // ================================
        togglePause: (req, res) => {
            isPaused = !isPaused;
            res.redirect('/dashboard');
        },

        getPauseState: () => isPaused
    };
};