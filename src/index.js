
require('dotenv').config();
const fetch = require('node-fetch');
const mongoose=require('mongoose');
const express = require('express');
const cors = require('cors');
const bcrypt=require('bcrypt');
const jwt = require("jsonwebtoken");
const multer=require('multer');
const path = require('path');
const fs = require('fs');


const app = express();
const port = process.env.PORT||3000;
const baseUrl = 'http://localhost:3000/public/img/users/';
const uploadDir = './public/img/users';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({ storage: storage })



const popularMoviesRoutes=require('./routes/popularMovies');
const imagePathsMovieRoutes=require('./routes/imagePathsMovie');
const  findMediaTypeByIdRoutes = require('./routes/findMediaTypeById');
const imagePathsTVseriesRoutes=require('./routes/imagePathsTVseries');
const searchMoviesWithGenresRoutes = require('./routes/searchMoviesWithGenres');
const searchTVseriesWithGenresRoutes = require('./routes/searchTVSeriesWithGenres');
const searchMoviesRoutes=require('./routes/searchMovies');
const searchTVSeriesRoutes=require('./routes/searchTVSeries');
const popularTVseriesRoutes = require('./routes/popularTVSeries');
const trendingRoutes = require('./routes/trending');
const User = require('./models/userModel');
const Profile=require('./models/profileModel');
const uploadCloudinary = require('./utils/cloudinary');




// CORS configuration
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:3000', 'https://movie-tv-app-phi.vercel.app', 'https://delightful-fudge-553d4a.netlify.app'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

//jwt verification middleware
function authenticateToken(req, res, next) {
  console.log('verifying token')
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}
//Connect to db


 
// Enable CORS for all routes
app.use(express.json());
app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: false }));

app.use('/api/popularMovies', popularMoviesRoutes);
app.use('/api/imagePathsMovie',imagePathsMovieRoutes);
app.use('/api/findMediaTypeById',findMediaTypeByIdRoutes);
app.use('/api/imagePathsTVseries',imagePathsTVseriesRoutes);
app.use('/api/searchMoviesWithGenres',searchMoviesWithGenresRoutes);
app.use('/api/searchTVSeriesWithGenres',searchTVseriesWithGenresRoutes);
app.use('/api/searchMovies',searchMoviesRoutes);
app.use('/api/searchTVSeries',searchTVSeriesRoutes);
app.use('/api/popularTVSeries',popularTVseriesRoutes);
app.use('/api/trending',trendingRoutes);



// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the movie API. Use /api/popularMovies or /api/trending to get data.' });
});

// Signup route

app.post('/api/signup', async (req, res) => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);

    const { username, email, password } = req.body;

    // Check if the email is already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword
    });

    // Save the new user to the database
    await newUser.save();

    // Create a profile for the newly registered user
    const newProfile = new Profile({
      userId: newUser._id,
      username: newUser.username,
      email: newUser.email
    });

    // Save the profile to the database
    await newProfile.save();

    // Generate a JWT token
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "1h"
    });

    // Respond with success message and token
    res.status(201).json({ message: "User registered successfully", jwtToken: token, userId: newUser._id });
  } catch (error) {
    console.error("registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    // Close the MongoDB connection
    mongoose.connection.close();
  }
});

//login route


app.post('/api/login', async (req, res) => {
 
  let connection;
  try {
    // Open MongoDB connection
    connection = await mongoose.connect(process.env.MONGODB_URI);
    

    const { email, password } = req.body;
    

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email' });
    }

    // Verify the password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate an access token
    const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h' // Token expires in 1 hour
    });
    

    // Send the access token in the response
    res.status(200).json({ message: 'Login successful', jwtToken: accessToken, userId: user._id });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    // Close the MongoDB connection
    if (connection) {
      await mongoose.connection.close();
      
    }
  }
});

app.post('/api/verify-token', async (req, res) => {
 
  const token = req.body.token;
  console.log('verify token route hit')
  console.log(token)
  

  if (!token) {
    return res.status(401).json({ isValid: false, error: 'No token provided' });
  }

  let connection;
  try {
    connection = await mongoose.connect(process.env.MONGODB_URI);
    

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError);
      return res.status(401).json({ isValid: false, error: 'Invalid token' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      
      return res.status(401).json({ isValid: false, error: 'User not found' });
    }
    
    res.json({ isValid: true, userId: user._id });
  } catch (error) {
    console.error('General error:', error);
    res.status(500).json({ isValid: false, error: 'Server error' });
  } finally {
    if (connection) {
      await mongoose.connection.close();
      
    }
  }
});


//Upload photo route
app.options('/api/upload-avatar', cors(corsOptions));
app.patch('/api/upload-avatar', cors(corsOptions), upload.single('avatar'),authenticateToken, async (req, res) => {
   
  try {
    // Check if file exists
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
     // Upload to Cloudinary
     const cloudinaryResult = await uploadCloudinary(path.join(__dirname, '..', 'public', 'img', 'users', req.file.filename));
     if (!cloudinaryResult) {
       return res.status(500).json({ message: 'Error uploading to Cloudinary' });
     }
    

    await mongoose.connect(process.env.MONGODB_URI);

    // Update the profile picture field
    const updatedProfile = await Profile.findOneAndUpdate(
      { userId: req.body.userId },
      { profilePicture: cloudinaryResult.croppedUrl, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    

    if (!updatedProfile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    res.status(200).json({ message: 'Profile picture updated successfully', profile: updatedProfile });
  } catch (error) {
    console.error('Error in file upload:', error);
    res.status(500).json({ message: 'Error uploading file', error: error.message });
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
  }
});
app.get('/api/profilepic',authenticateToken, async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const profile = await Profile.findOne({ userId: userId });

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    res.status(200).json({ 
      profilePicUrl: profile.profilePicture,
      
    });

  } catch (error) {
    console.error('Error fetching profile picture:', error);
    res.status(500).json({ message: 'Error fetching profile picture', error: error.message });
  } finally {
    await mongoose.connection.close();
  }
});


        




 
app.get('/api/trailer', async (req, res) => {
  const { mediaType, id } = req.query;

 

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/${mediaType}/${id}/videos?api_key=${process.env.TMDB_API_KEY}&language=en-US`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);

    
  } catch (error) {
    console.error('Error fetching trailer from TMDB:', error);
    res.status(500).json({ error: 'Error fetching trailer' });
  }
});



//Add bookmarks
app.patch('/api/bookmark', cors(corsOptions),authenticateToken, async (req, res) => {
  let connection;
  try {
    // Open MongoDB connection
    await mongoose.connect(process.env.MONGODB_URI);
    
    connection = mongoose.connection;

    const { userId, action } = req.query;
    const { mediaType, details } = req.body;
    console.log(mediaType,details)
    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let bookmarkList;
    if (mediaType === 'movie') {
      bookmarkList = user.movieBookmarks;
    } else if (mediaType === 'tv') {
      bookmarkList = user.tvSeriesBookmarks;
    } else {
      return res.status(400).json({ message: 'Invalid media type' });
    }

    const existingBookmarkIndex = bookmarkList.findIndex(bookmark => bookmark.details.id === details.id);

    if (action === 'add') {
      if (existingBookmarkIndex === -1) {
        bookmarkList.push({ mediaType, details });
      }
    } else if (action === 'remove') {
      if (existingBookmarkIndex !== -1) {
        bookmarkList.splice(existingBookmarkIndex, 1);
      }
    } else {
      return res.status(400).json({ message: 'Invalid action. Use "add" or "remove".' });
    }

    // Save the updated user document
    await user.save();

    res.status(200).json({ 
      message: `Bookmark ${action === 'add' ? 'added' : 'removed'} successfully`, 
      movieBookmarks: user.movieBookmarks,
      tvSeriesBookmarks: user.tvSeriesBookmarks
    });

  } catch (error) {
    console.error('Error updating bookmark:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    // Close MongoDB connection
    if (connection) {
      await connection.close();
      
    }
  }
});


//fetch bookmarks
app.get('/api/fetchbookmarks',authenticateToken, async (req, res) => { 
  const { userId } = req.query;
  

  try
{
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const { movieBookmarks, tvSeriesBookmarks } = user;
    res.status(200).json({ movieBookmarks, tvSeriesBookmarks });
  } catch (error) { console.error('Error fetching bookmarks:', error); res.status(500).json({ message: 'Internal server error' }); } finally { await mongoose.connection.close(); } });


 //fetch cast and website details

 app.get('/api/castandwbsite', async (req, res) => {
 
  const { mediaType, movieId } = req.query;

  // Validate mediaType
  if (mediaType !== 'movie' && mediaType !== 'tv') {
    return res.status(400).json({ error: 'Invalid media type. Must be "movie" or "tv".' });
  }

  try {
    // Fetch cast details
    const castUrl = `https://api.themoviedb.org/3/${mediaType}/${movieId}/credits?api_key=${process.env.TMDB_API_KEY}`;
    const castResponse = await fetch(castUrl);
    const castData = await castResponse.json();

    // Fetch additional details including website
    const detailsUrl = `https://api.themoviedb.org/3/${mediaType}/${movieId}?api_key=${process.env.TMDB_API_KEY}`;
    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json();

    // Extract relevant information
    const cast = castData.cast.slice(0, 10);
    const websiteurl = detailsData.homepage;

    

    // Send the combined data
    res.json({
      cast,
      website: websiteurl,
      // You can include more fields from detailsData if needed
    })
  } catch (error) {
    console.error('Error fetching cast and website details:', error);
    res.status(500).json({ error: 'An error occurred while fetching cast and website details' });
  }
});












// For local testing
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

//module.exports = app;