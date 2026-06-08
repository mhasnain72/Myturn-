// plugins/token-system/services/tokenService.js
module.exports = (db) => {
    return {
        // Can add service methods here if needed
        testConnection: () => {
            return new Promise((resolve, reject) => {
                db.query('SELECT 1', (err) => {
                    if (err) reject(err);
                    else resolve(true);
                });
            });
        }
    };
};