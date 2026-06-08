// plugins/token-system/controllers/apiController.js
module.exports = (db) => {
    let isPaused = false;
    
    return {
        // ✅ FIXED: Get queue status with EXACT structure React Native expects
        getQueueStatus: (req, res) => {
            // 1. Get all waiting tokens
            db.query(
                `SELECT id, token_number, customer_name, status 
                 FROM tokens 
                 WHERE status = 'Waiting' 
                 ORDER BY token_number ASC`,
                (err, waitingTokens) => {
                    
                // 2. Get currently serving token
                db.query(
                    `SELECT id, token_number, customer_name, status 
                     FROM tokens 
                     WHERE status = 'Calling' 
                     LIMIT 1`,
                    (err, servingToken) => {
                        
                    res.json({
                        isPaused: isPaused,
                        totalWaiting: waitingTokens ? waitingTokens.length : 0,
                        currentServing: servingToken && servingToken[0] ? servingToken[0] : null,
                        allTokens: waitingTokens || []  // ✅ MUST be array
                    });
                });
            });
        },
        
        // ✅ FIXED: Generate token with proper validation
        generateTokenAPI: (req, res) => {
            const { customerName, serviceType, cnicNum } = req.body;
            
            console.log("📱 Token request:", { customerName, serviceType, cnicNum });
            
            // Check if system is paused
            if (isPaused) {
                return res.json({ 
                    success: false, 
                    message: "Service is paused. Please try again later." 
                });
            }

            // Validate required fields
            if (!customerName || !serviceType) {
                return res.json({
                    success: false,
                    message: "Name and service type are required"
                });
            }

            // Generate next token number
            db.query('SELECT MAX(token_number) as lastToken FROM tokens', (err, results) => {
                let nextToken = (results[0]?.lastToken || 0) + 1;

                // Insert token with 'Waiting' status
                const sql = `
                    INSERT INTO tokens 
                    (token_number, customer_name, service_type, cnic_num, status)
                    VALUES (?, ?, ?, ?, 'Waiting')
                `;

                db.query(sql,
                    [nextToken, customerName, serviceType, cnicNum || null],
                    (err, result) => {
                        if (err) {
                            console.error("❌ Token generation error:", err);
                            return res.json({
                                success: false,
                                message: "Failed to generate token"
                            });
                        }
                        
                        console.log(`✅ Token #${nextToken} generated for ${customerName}`);
                        
                        res.json({
                            success: true,
                            token: nextToken,
                            message: `Token #${nextToken} generated successfully`
                        });
                    }
                );
            });
        },
        
        // Toggle pause state
        togglePause: (req, res) => {
            isPaused = !isPaused;
            res.json({ 
                success: true, 
                isPaused: isPaused,
                message: isPaused ? "System paused" : "System resumed" 
            });
        },
        
        getPauseState: () => isPaused
    };
};