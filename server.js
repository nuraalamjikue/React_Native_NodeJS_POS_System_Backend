const express = require("express");
const sql = require('mssql');
const app = express();
const bodyParser = require('body-parser');
const globals = require('node-global-storage');
const moment = require('moment');
const dotenv = require('dotenv');
dotenv.config();
const path = require('path');
const jwt = require('jsonwebtoken');
const { expressjwt: expressJwt } = require("express-jwt"); // Correct import
const multer = require('multer'); // Add this line
const bcrypt = require('bcryptjs');
app.use(express.json());
//app.options('*', cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const cors = require('cors');

// Serve static files from the 'uploads' folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(cors({
    origin: 'http://localhost:3000', // Allow only your frontend domain
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true, // Allow cookies or authentication tokens
}));


// CORS configuration
const corsOptions = {
    origin: 'http://localhost:3000', // Replace with your React app’s origin
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
};
app.use(cors(corsOptions));

// Configure multer for file upload handling
// const uploadFolder = path.join(__dirname, 'uploads'); // Directory to save uploaded files
// if (!fs.existsSync(uploadFolder)) {
//     fs.mkdirSync(uploadFolder);
// }
// Configure file storage for images
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({ storage });

// JWT middleware
const requireAuth = expressJwt({
    secret: process.env.JWT_SECRET,
    algorithms: ['HS256'],
    requestProperty: 'auth',
    getToken: (req) => req.headers['authorization']?.split(' ')[1],
});

const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );
};

app.get('/', (req, res) => {
    return res.json('success');
});

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: true,
    }
};

sql.connect(dbConfig, (err) => {
    if (err) {
        console.error('Database connection failed:', err.message, 'Stack:', err.stack);
    } else {
        console.log('Database connected successfully');
    }
});

// API endpoint to handle product creation
app.post('/api/products', upload.single('Image'), async (req, res) => {
    try {
        const { Item_Name, Item_Price, CategoryID, IsActive, Create_By } = req.body;
        const imagePath = req.file ? req.file.path : null;

        // console.log(Item_Name, Item_Price, CategoryID, IsActive, Create_By);


        const request = new sql.Request();
        const result = await request.query(`
        INSERT INTO POS_BS_Product (Item_Name,Item_Price,CategoryID, IsActive, Create_By, Image)
        VALUES ('${Item_Name}','${Item_Price}', ${CategoryID}, ${IsActive}, ${Create_By},  '${imagePath}')
      `);

        res.status(200).json({ success: true, message: 'Product added successfully', result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error', error });
    }
});

// Update an existing product
app.put('/api/products/:id', upload.single('Image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { Item_Name, Item_Price, CategoryID, IsActive, Create_By, Create_Date } = req.body;
        const imagePath = req.file ? req.file.path : null;

        console.log(Item_Name, Item_Price, CategoryID, IsActive);


        await sql.connect(dbConfig);
        const request = new sql.Request();

        let query = `
            UPDATE POS_BS_Product
            SET Item_Name = '${Item_Name}', 
            Item_Price = '${Item_Price}',
            CategoryID = '${CategoryID}',
              IsActive = ${IsActive},
                Create_By = ${Create_By}
        `;

        // Include image update only if a new image is uploaded
        if (imagePath) {
            query += `, Image = '${imagePath}' `;
        }

        query += `WHERE Id = ${id}`;

        const result = await request.query(query);
        res.status(200).json({ success: true, message: 'Product updated successfully', result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error', error });
    }
});


app.post('/api/Categories', upload.single('Image'), async (req, res) => {
    try {
        const { Category_Name } = req.body;
        const request = new sql.Request();
        const result = await request.query(`
        INSERT INTO POS_BS_Categories (Categories_Name)
        VALUES ('${Category_Name}')
      `);
        res.status(200).json({ success: true, message: 'Categories added successfully', result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error', error });
    }
});


app.put('/api/Categories/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { Category_Name } = req.body;

        // Log the input for debugging (You can remove these in production)
        console.log('Category Name: ' + Category_Name);
        console.log('Category ID: ' + id);

        // Ensure connection to the database
        await sql.connect(dbConfig);
        const request = new sql.Request();

        // Prepare and execute the update query using parameterized inputs
        const query = `
            UPDATE POS_BS_Categories
            SET Categories_Name = @Category_Name
            WHERE Id = @Id
        `;

        // Adding parameters to the query
        request.input('Category_Name', sql.NVarChar, Category_Name);
        request.input('Id', sql.Int, id);

        // Execute the query
        const result = await request.query(query);

        res.status(200).json({ success: true, message: 'Category updated successfully', result });
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ success: false, message: 'Server error', error });
    }
});



// Handle the PUT request for updating user status
app.put('/api/UpdateUserStatus/:id', async (req, res) => {
    const { id } = req.params;  // userId is in the URL parameter
    const { isActive } = req.body;  // isActive is in the request body



    try {
        // Connect to the database
        await sql.connect(dbConfig);

        // Prepare the SQL query to update the user status
        const query = `
            UPDATE POS_User_Login
            SET IsActive = @IsActive
            WHERE Id = @Id
        `;

        const request = new sql.Request();
        request.input('IsActive', sql.Int, isActive);  // Set the IsActive value
        request.input('Id', sql.Int, id);  // Set the userId (ID value)

        // Execute the query
        const result = await request.query(query);

        // Return success message
        res.status(200).json({ success: true, message: 'Status updated successfully' });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ success: false, message: 'Server error', error });
    }
});




app.get('/api/CategoriesList', requireAuth, async (req, res) => {
    try {
        const request = new sql.Request();
        const result = await request.query('select Id,Categories_Name from POS_BS_Categories');
        res.json(result.recordset);
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Server error');
    }
});

app.get('/api/getAllProduct/:ProductName', requireAuth, async (req, res) => {
    try {
        const { ProductName } = req.params;  // Extract ProductName from the URL params
        const request = new sql.Request();
        request.input('ProductName', sql.NVarChar, `%${ProductName}%`); // Add wildcards for LIKE

        // Query the database
        const query = `
            SELECT a.id, a.Item_Name, a.Image, a.Item_Price, b.Categories_Name, 0 AS qty 
            FROM POS_BS_Product a
            LEFT JOIN POS_BS_Categories b ON b.Id = a.CategoryID 
            WHERE a.Item_Name LIKE @ProductName
        `;

        const result = await request.query(query);

        // Send the result back as JSON
        res.json(result.recordset);
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Server error');
    }
});

app.get('/api/getAllProductList', requireAuth, async (req, res) => {
    try {
        const request = new sql.Request();
        const query = `
            SELECT a.id, a.Item_Name,a.Item_Price, a.Image, a.IsActive,a.CategoryID, b.Categories_Name, 0 AS qty 
            FROM POS_BS_Product a
            LEFT JOIN POS_BS_Categories b ON b.Id = a.CategoryID`;

        const result = await request.query(query);

        // Send the result back as JSON
        res.json(result.recordset);
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Server error');
    }
});


app.get('/api/getAllProductListBySales', requireAuth, async (req, res) => {
    try {
        const request = new sql.Request();
        const query = `
            SELECT a.id, a.Item_Name,a.Item_Price, a.Image, a.IsActive, b.Categories_Name, 0 AS qty 
            FROM POS_BS_Product a
            LEFT JOIN POS_BS_Categories b ON b.Id = a.CategoryID
            where a.IsActive=1
        `;

        const result = await request.query(query);

        // Send the result back as JSON
        res.json(result.recordset);
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Server error');
    }
});






// Example of a protected route
app.get('/api/GetLastStockQty', requireAuth, async (req, res) => {
    try {
        const request = new sql.Request();
        const result = await request.query('select * from [dbo].[BS_Items]');
        res.json(result.recordset);
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Server error');
    }
});



app.get('/api/GetUserstatus', requireAuth, async (req, res) => {
    try {
        const request = new sql.Request();
        const query = `select Id,UserName,Roll_id,IsActive from POS_User_Login`;

        const result = await request.query(query);

        // Send the result back as JSON
        res.json(result.recordset);
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Server error');
    }
});

app.get('/api/GetProduct/:StoreId', async (req, res) => {
    const { StoreId } = req.params;  // Extract StoreId from the URL params
    console.log(`Get Product for StoreId: ${StoreId}`);

    try {
        const request = new sql.Request();
        const query = `
            SELECT TOP 10 
                a.id AS Id,
                Code,
                Name,
                0 AS qty,
                CurrentBalance 
            FROM 
                [192.168.15.16].[Central_Inventory_DB].[dbo].[POS_BS_Product] a 
            LEFT JOIN 
                [192.168.15.16].[Central_Inventory_DB].[dbo].[ItemCurrentBalance] b 
            ON 
                b.ItemId = a.id 
            WHERE 
                CurrentBalance > 0 
                AND b.storeid = @StoreId
        `;

        // Add the StoreId as a parameter to the SQL query to prevent SQL injection
        request.input('StoreId', sql.Int, StoreId);

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Server error');
    }
});

app.post('/api/register', async (req, res) => {
    const { username, password, rollsetup } = req.body;

    if (!username || !password || !rollsetup) {
        return res.status(400).json({ message: 'Username, password and Roll are required' });
    }

    // console.log('Register' + username);
    // console.log('password' + password);
    // console.log('rollsetup' + rollsetup);


    try {
        // Check if user already exists
        const result = await sql.query`SELECT * FROM POS_User_Login WHERE UserName = ${username}`;
        if (result.recordset.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user into the Users table
        await sql.query`INSERT INTO POS_User_Login (UserName, Password,Roll_id) VALUES (${username}, ${hashedPassword},${rollsetup})`;

        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});


app.get('/api/GetLastInvoiceNo', requireAuth, async (req, res) => {
    try {
        const request = new sql.Request();
        const query = `select top (1) Invoice from POS_sales order by id desc`;

        const result = await request.query(query);

        // Send the result back as JSON
        res.json(result.recordset);
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Server error');
    }
});

// Example for creating sale in POS_Sales
app.post('/api/createSale', async (req, res) => {
    const { Invoice, TotalAmount, Create_By } = req.body;
    console.log(Invoice, TotalAmount, Create_By);

    try {
        const request = new sql.Request();

        // Using parameterized query to avoid SQL injection
        const result = await request.input('Invoice', sql.NVarChar, Invoice)
            .input('TotalAmount', sql.Decimal, TotalAmount)
            .input('Create_By', sql.Int, Create_By)
            .query(`
                                    INSERT INTO POS_Sales ( TotalAmount, Create_By)
                                    VALUES ( @TotalAmount, @Create_By);
                                    SELECT SCOPE_IDENTITY() AS Id;
                                  `);

        // Send a single response with the inserted Id
        res.status(200).json({ success: true, message: 'Product added successfully', Id: result.recordset[0].Id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error', error });
    }
});



// Example for creating sale details in POS_Sales_Details
app.post('/api/createSaleDetails', async (req, res) => {
    const saleDetails = req.body; // Array of sale details data

    try {
        const promises = saleDetails.map((detail) => {
            const { salesId, ItemId, Create_By } = detail;
            const Create_Date = new Date(); // Set current date for Create_Date

            // Create a new request instance for each sale detail
            const request = new sql.Request();

            // Bind parameters
            return request
                .input('salesId', sql.Int, salesId)
                .input('ItemId', sql.Int, ItemId)
                .input('Create_By', sql.Int, Create_By)
                .input('Create_Date', sql.DateTime, Create_Date)
                .query(`
                    INSERT INTO POS_Sales_Details (salesId, ItemId, Create_By, Create_Date)
                    VALUES (@salesId, @ItemId, @Create_By, @Create_Date)
                `);
        });

        // Execute all queries in parallel
        await Promise.all(promises);

        res.status(200).json({ message: 'Sale details successfully inserted' });
    } catch (error) {
        console.error('Error inserting sale details:', error);
        res.status(500).json({ message: 'Error inserting sale details' });
    }
});




app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    console.log('Login attempt for', username);

    try {
        const request = new sql.Request();

        // Use parameterized queries to prevent SQL injection
        request.input('username', sql.NVarChar, username);

        // Query to find the user by username
        const query = 'SELECT * FROM [dbo].[POS_User_Login] WHERE UserName = @username and IsActive=1';
        const result = await request.query(query);

        if (result.recordset.length === 0) {
            return res.status(401).send('Invalid credentials');  // User does not exist
        }

        const user = result.recordset[0];



        // Compare the stored hashed password with the provided password
        const isPasswordValid = await bcrypt.compare(password, user.Password);

        if (!isPasswordValid) {
            return res.status(401).send('Invalid credentials');  // Passwords don't match
        }

        // Password is valid, generate a JWT token (optional)
        const token = generateToken(user);

        // Send the token and RoleID in the response
        res.json({ token, roleId: user.Roll_id });
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Server error');
    }
});

// Function to generate JWT token
// function generateToken(user) {
//     const payload = {
//         userId: user.UserId,  // Assuming UserId exists in your database schema
//         username: user.UserName,
//     };

//     // Replace 'your_jwt_secret' with a secure key stored in your environment variables
//     const token = jwt.sign(payload, 'your_jwt_secret', { expiresIn: '1h' });  // 1 hour expiry
//     return token;
// }
app.listen(process.env.PORT || 3000, () => console.log(`Example app listening on port ${process.env.PORT || 3000}!`));
