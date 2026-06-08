const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// ✅ SIMPLE SESSION SIMULATION (No express-session needed)
const session = require('express-session');

app.use(session({
    secret: 'smartqueue_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));


// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Configuration
const db = require('./config/database');

// Connect to database
db.connect((err) => {
    if (err) {
        console.log("❌ SQL Connection Error:", err.message);
        return;
    }
    console.log("🚀 MySQL Connected Successfully!");
});

app.set('db', db);
app.set('isPaused', false);

// View engine setup
app.set('views', path.join(__dirname, 'plugins/token-system/views'));
app.set('view engine', 'ejs');

// Load Token System Plugin
try {
    const tokenPlugin = require('./plugins/token-system/index.js');
    tokenPlugin.init(app);
    console.log("✅ Token System Plugin Loaded");
    
    // ✅ FIXED: Explicitly load API routes
    const db = app.get('db');
    const apiController = require('./plugins/token-system/controllers/apiController')(db);
    require('./plugins/token-system/routes/apiRoutes')(app, apiController);
    console.log("✅ API Routes Loaded");
    
} catch (error) {
    console.log("❌ Token Plugin Error:", error.message);
}
// ✅ LOAD COUNTER SYSTEM
try {
    // Check if counter files exist
    const fs = require('fs');
    const counterControllerPath = path.join(__dirname, 'plugins/token-system/controllers/counterController.js');
    
    if (fs.existsSync(counterControllerPath)) {
        const counterController = require(counterControllerPath)(db);
        const counterRoutes = require('./plugins/token-system/routes/counterRoutes');
        counterRoutes(app, counterController);
        console.log("✅ Counter System Loaded");
    } else {
        console.log("⚠️ Counter Controller not found, using fallback routes");
        setupFallbackCounterRoutes(app, db);
    }
} catch (error) {
    console.log("⚠️ Counter System Error:", error.message);
    setupFallbackCounterRoutes(app, db);
}

// ✅ FALLBACK COUNTER ROUTES (If files don't exist)
function setupFallbackCounterRoutes(app, db) {
    console.log("🔧 Setting up fallback counter routes...");
    
    // Counter Login Page
    app.get('/counter-login', (req, res) => {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Counter Login</title>
                <style>
                    body { font-family: Arial; padding: 50px; background: #f5f7fa; }
                    .login-container { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
                    h2 { text-align: center; color: #4361ee; }
                    input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px; }
                    button { width: 100%; padding: 12px; background: #4361ee; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
                    .error { color: red; text-align: center; }
                    .demo { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="login-container">
                    <h2>🔐 Counter Login</h2>
                    
                    <form method="POST" action="/counter-login">
                        <input type="text" name="login_id" placeholder="Counter ID (e.g., counter1)" required>
                        <input type="password" name="password" placeholder="Password" required value="counter123">
                        <button type="submit">Login</button>
                    </form>
                    
                    <div class="demo">
                        <h4>Demo Credentials:</h4>
                        <p>counter1 / counter123</p>
                        <p>counter2 / counter123</p>
                        <p>counter3 / counter123</p>
                        <p>counter4 / counter123</p>
                    </div>
                </div>
            </body>
            </html>
        `);
    });
    
    // Handle Login POST
    app.post('/counter-login', (req, res) => {
        const { login_id, password } = req.body;
        
        // Simple validation
        if (login_id && password === 'counter123' && login_id.startsWith('counter')) {
            const counterNum = login_id.replace('counter', '');
            if (['1','2','3','4'].includes(counterNum)) {
                req.session.counterId = parseInt(counterNum);
                req.session.counterNumber = parseInt(counterNum);
                req.session.counterName = `Counter ${counterNum}`;
                
                console.log(`✅ Counter ${counterNum} logged in`);
                return res.redirect(`/counter/${counterNum}`);
            }
        }
        
        res.send(`
            <script>
                alert('Invalid credentials! Use: counter1/counter123');
                window.location.href = '/counter-login';
            </script>
        `);
    });
    
    // Counter Dashboard
    app.get('/counter/:id', (req, res) => {
        const counterId = req.params.id;
        
        // Check if logged in
        if (!req.session.counterId || req.session.counterId != counterId) {
            return res.redirect('/counter-login');
        }
        
        // Get counter data from database
        db.query('SELECT * FROM counters WHERE counter_number = ?', [counterId], (err, counters) => {
            if (err || counters.length === 0) {
                return res.send(`Counter ${counterId} not found in database`);
            }
            
            const counter = counters[0];
            
            // Get current token for this counter
            db.query(
                `SELECT * FROM tokens 
                 WHERE assigned_counter = ? 
                 AND status = 'Calling' 
                 ORDER BY served_at DESC LIMIT 1`,
                [counterId], (err, currentToken) => {
                    
                // Get next tokens
                db.query(
                    `SELECT * FROM tokens 
                     WHERE status = 'Waiting' 
                     AND assigned_counter IS NULL
                     ORDER BY token_number ASC LIMIT 5`,
                    (err, nextTokens) => {
                        
                    // Render dashboard
                    res.render('counter-dashboard', {
                        counter: counter,
                        currentToken: currentToken[0] || null,
                        nextTokens: nextTokens || [],
                        isPaused: false
                    });
                });
            });
        });
    });
    
    // Counter Actions
    app.get('/counter/:id/complete', (req, res) => {
        if (!req.session.counterId) return res.redirect('/counter-login');
        
        const counterId = req.params.id;
        
        // Mark current token as completed
        db.query(
            `UPDATE tokens 
             SET status = 'Completed', 
                 completed_at = NOW(),
                 assigned_counter = NULL
             WHERE assigned_counter = ? 
             AND status = 'Calling'`,
            [counterId], (err) => {
                
            // Auto-assign next token
            db.query(
                `SELECT id FROM tokens 
                 WHERE status = 'Waiting' 
                 AND assigned_counter IS NULL
                 ORDER BY token_number ASC LIMIT 1`,
                (err, nextToken) => {
                    
                if (nextToken && nextToken.length > 0) {
                    db.query(
                        `UPDATE tokens 
                         SET assigned_counter = ?, 
                             status = 'Calling',
                             served_at = NOW()
                         WHERE id = ?`,
                        [counterId, nextToken[0].id], (err) => {
                            console.log(`✅ Token assigned to Counter ${counterId}`);
                        });
                }
                
                res.redirect(`/counter/${counterId}`);
            });
        });
    });
    
    app.get('/counter/:id/call-next', (req, res) => {
        if (!req.session.counterId) return res.redirect('/counter-login');
        
        const counterId = req.params.id;
        
        // Assign next token
        db.query(
            `SELECT id FROM tokens 
             WHERE status = 'Waiting' 
             AND assigned_counter IS NULL
             ORDER BY token_number ASC LIMIT 1`,
            (err, nextToken) => {
                
            if (nextToken && nextToken.length > 0) {
                db.query(
                    `UPDATE tokens 
                     SET assigned_counter = ?, 
                         status = 'Calling',
                         served_at = NOW()
                     WHERE id = ?`,
                    [counterId, nextToken[0].id], (err) => {
                        console.log(`✅ Token assigned to Counter ${counterId}`);
                        res.redirect(`/counter/${counterId}`);
                    });
            } else {
                res.redirect(`/counter/${counterId}`);
            }
        });
    });
    
    app.get('/counter/:id/decline', (req, res) => {
        if (!req.session.counterId) return res.redirect('/counter-login');
        
        const counterId = req.params.id;
        
        db.query(
            `UPDATE tokens 
             SET status = 'Declined', 
                 completed_at = NOW(),
                 assigned_counter = NULL
             WHERE assigned_counter = ? 
             AND status = 'Calling'`,
            [counterId], (err) => {
                
            // Auto-assign next
            db.query(
                `SELECT id FROM tokens 
                 WHERE status = 'Waiting' 
                 AND assigned_counter IS NULL
                 ORDER BY token_number ASC LIMIT 1`,
                (err, nextToken) => {
                    
                if (nextToken && nextToken.length > 0) {
                    db.query(
                        `UPDATE tokens 
                         SET assigned_counter = ?, 
                             status = 'Calling',
                             served_at = NOW()
                         WHERE id = ?`,
                        [counterId, nextToken[0].id]);
                }
                
                res.redirect(`/counter/${counterId}`);
            });
        });
    });
    
    app.get('/counter-logout', (req, res) => {
        if (req.session) {
            delete req.session.counterId;
            delete req.session.counterNumber;
        }
        res.redirect('/counter-login');
    });
}

// Root route
app.get('/', (req, res) => {
    res.render('home');   // home.ejs render karega
});
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                    SMART QUEUE SYSTEM                    ║
╠══════════════════════════════════════════════════════════╣
║ 🚀 Server: http://localhost:${PORT}                      ║
║ 📱 Kiosk: http://localhost:${PORT}/kiosk                  ║
║ 📊 Admin: http://localhost:${PORT}/dashboard             ║
║ 🖥️ Counter: http://localhost:${PORT}/counter-login       ║
║                                                           ║
║ 🔐 Counter Logins:                                       ║
║   • counter1 / counter123                                 ║
║   • counter2 / counter123                                 ║
║   • counter3 / counter123                                 ║
║   • counter4 / counter123                                 ║
╚══════════════════════════════════════════════════════════╝
    `);
});