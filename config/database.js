const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'mysql.railway.internal',
    user: 'root',
    password: 'LqmAEMJqoWNakSiZAzAsSwyQwAzRfcMp',
    database: 'railway',
    port: 3306
});

db.connect((err) => {
    if (err) {
        console.log('❌ Database Error:', err.message);
    } else {
        console.log('✅ Database Connected');
    }
});

module.exports = db;