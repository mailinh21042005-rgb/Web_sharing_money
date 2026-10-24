const sql = require('mssql'); 

const connectDB = async () => {
    try {
        await sql.connect(process.env.AZURE_SQL_CONNECTIONSTRING);
        console.log('Kết nối Azure SQL Web_sharing_money thành công!');
    } catch (err) {
        console.error('Lỗi kết nối Azure SQL:', err);
    }
};

module.exports = { sql, connectDB };