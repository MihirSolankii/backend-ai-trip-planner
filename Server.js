const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
var admin = require("firebase-admin");

// Initialize Firebase Admin SDK
const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore(); // Initialize Firestore instance
const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY); // Use environment variable for security

// CORS configuration
app.use(cors({
  origin: 'https://ai-trip-planner-vert.vercel.app', // Replace with your frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.post('/create-checkout-session', async (req, res) => {
  const { email, amount } = req.body;

  try {
    // Fetch the user document by email
    const userCollection = db.collection('AITrips'); // Use Firestore instance
    const userQuery = userCollection.where('userEmail', '==', email);
    const userSnapshot = await userQuery.get();

    if (userSnapshot.empty) {
      return res.status(404).send({ error: 'User not found' });
    }

    const userDoc = userSnapshot.docs[0];
    console.log('User document:', userDoc.data());
    
    const userId = userDoc.id;

    // Create a Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd', // Use 'inr' for Indian Rupees
          product_data: {
            name: 'Credits Purchase',
          },
          unit_amount: amount, // Amount in cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `http://localhost:5173/update-trip-count?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:4000/cancel`,
      metadata: {
        email,
        creditsToAdd: (amount / 100), // Assuming 1 USD = 10 credits
      },
    });

    // Return the URL of the Checkout page
    res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).send({ error: error.message });
  }
});

app.get('/update-trip-count', async (req, res) => {
  const { session_id } = req.query;

  try {
    // Retrieve the Checkout Session
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Extract email and creditsToAdd from metadata
    const email = session.metadata.email;
    const creditsToAdd = parseFloat(session.metadata.creditsToAdd);

    // Use email as the document ID in the users collection
    const userRef = db.collection('users').doc(email);

    // Fetch the user document
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).send({ error: 'User not found' });
    }

    // Update tripCount field
    await userRef.update({
      tripCount: admin.firestore.FieldValue.increment(creditsToAdd),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.send({ success: true });
  } catch (error) {
    console.error('Error updating trip count:', error);
    res.status(500).send({ error: error.message });
  }
});

const PORT =   5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
