// plugins/token-system/controllers/tokenController.js
module.exports = (db) => {
    let isPaused = false;
    
    const callNextToken = (res) => {
        db.query(
            `SELECT id FROM tokens 
             WHERE status = 'Waiting' 
             ORDER BY token_number ASC LIMIT 1`,
            (err, next) => {
                if (next && next.length > 0) {
                    db.query(
                        `UPDATE tokens 
                         SET status = 'Calling' 
                         WHERE id = ?`,
                        [next[0].id], 
                        () => {
                            if (res) res.redirect('/dashboard');
                        }
                    );
                } else {
                    if (res) res.redirect('/dashboard');
                }
            }
        );
    };
    
    return {
        getKiosk: (req, res) => {
            // Pass any existing form data back to the view
            res.render('kiosk', { 
                isPaused: isPaused,
                customerName: req.query.name || '',
                serviceType: req.query.service || '',
                cnicNum: req.query.cnic || ''
            });
        },

        generateToken: (req, res) => {
            if (isPaused) {
                return res.redirect('/kiosk?error=paused');
            }

            const { customerName, serviceType, cnicNum } = req.body;
            
            console.log("📝 Kiosk Form Submission:", {
                name: customerName,
                service: serviceType,
                cnic: cnicNum || 'No CNIC (New Service)'
            });

            // ✅ VALIDATION
            if (!customerName || customerName.trim().length < 3) {
                return res.redirect('/kiosk?error=invalid_name');
            }

            if (!serviceType || !['New', 'Update', 'Renewal'].includes(serviceType)) {
                return res.redirect('/kiosk?error=invalid_service');
            }

            // ✅ CNIC validation - ONLY for Update/Renewal
            if (serviceType !== 'New') {
                if (!cnicNum) {
                    return res.redirect(`/kiosk?error=cnic_required&name=${encodeURIComponent(customerName)}&service=${serviceType}`);
                }
                
                const cnicPattern = /^[0-9]{5}-[0-9]{7}-[0-9]{1}$/;
                if (!cnicPattern.test(cnicNum)) {
                    return res.redirect(`/kiosk?error=invalid_cnic&name=${encodeURIComponent(customerName)}&service=${serviceType}`);
                }
            }

            // ✅ GENERATE TOKEN
            db.query('SELECT MAX(token_number) as lastToken FROM tokens', (err, results) => {
                if (err) {
                    console.error("❌ Database error:", err);
                    return res.redirect('/kiosk?error=database');
                }
                
                let nextToken = (results[0]?.lastToken || 0) + 1;

                // ✅ For New CNIC - cnicNum = NULL
                // ✅ For Update/Renewal - cnicNum = user input
                const finalCnic = (serviceType === 'New') ? null : cnicNum;

                const sql = `
                    INSERT INTO tokens
                    (token_number, customer_name, cnic_num, service_type, status)
                    VALUES (?, ?, ?, ?, 'Waiting')
                `;

                db.query(sql,
                    [nextToken, customerName.trim(), finalCnic, serviceType],
                    (err, result) => {
                        if (err) {
                            console.error("❌ Token insert error:", err);
                            return res.redirect('/kiosk?error=token_failed');
                        }
                        
                        console.log(`✅ Token #${nextToken} generated for ${customerName} (${serviceType})`);
                        
                        // ✅ SUCCESS - Show token page
                        res.redirect(`/token-success?num=${nextToken}&name=${encodeURIComponent(customerName)}&service=${serviceType}`);
                    }
                );
            });
        },

        tokenSuccess: (req, res) => {
            const { num, name, service } = req.query;
            
            // Determine if CNIC was required
            const requiredCNIC = service && service !== 'New';
            
            res.render('token-success', { 
                tokenNumber: num, 
                customerName: decodeURIComponent(name),
                serviceType: service || 'New',
                requiredCNIC: requiredCNIC,
                currentTime: new Date().toLocaleTimeString()
            });
        },

        togglePause: (req, res) => {
            isPaused = !isPaused;
            console.log(`⏸️ System ${isPaused ? 'PAUSED' : 'RESUMED'}`);
            res.redirect('/dashboard');
        },

        getPauseState: () => isPaused,
        callNextToken: callNextToken
    };
};