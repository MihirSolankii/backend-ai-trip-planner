const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
var admin = require("firebase-admin");

var serviceAccount = require("./config/ai-travel-planner-app-6c709-firebase-adminsdk-1o8rw-354423620f.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore(); // Initialize Firestore instance
const app = express();
const stripe = Stripe("sk_test_51PDpQjSHdhtwBKzMGV7Jv4rA2Tcduant8zLIqMZabTvx6hctdlkiJRqAAZGWICUzRVU0qIsxFT8OmzNy1sLDCsOT00uWMSTV6p"); // Use environment variable for security

app.use(cors());
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
    console.log(userDoc);
    
     const userId = userDoc.id;

    // Create a Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], // Use only 'card' for credit/debit card payments
      line_items: [{
        price_data: {
          currency: 'inr',
          product_data: {
            name: 'Credits Purchase',
          },
          unit_amount: amount, // Amount in cents (100 paise per INR)
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
    res.status(500).send({ error: error.message });
    console.log(error);
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
      res.status(500).send({ error: error.message });
      console.log(error);
    }
  });
  

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
