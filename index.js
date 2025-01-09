const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.REFRESH_TOKEN_SECRET);
const { MongoClient, ServerApiVersion, ObjectId, Admin } = require('mongodb');

const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.NAME}:${process.env.PASS}@cluster0.whh17.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    const userCollection = client.db('BistroDB').collection('users');
    const menuCollection = client.db('BistroDB').collection('menu');
    const reviewCollection = client.db('BistroDB').collection('reviews');
    const cartCollection = client.db('BistroDB').collection('carts');
    const paymentCollection = client.db('BistroDB').collection('payments');
    app.post('/jwt', async (req, res) => {
      const user = req.body;

      try {
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: '1h',
        });
        res.send({ token });
      } catch (error) {
        res.status(500).send({ error: 'Failed to generate token' });
      }
    });

    const verifyToken = (req, res, next) => {
      // Check if the authorization header exists
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }

      // Extract the token from the header
      const token = req.headers.authorization.split(' ')[1];
      if (!token) {
        return res.status(401).send({ message: 'unauthorized access' });
      }

      // Verify the token
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res
            .status(401)
            .send({ message: 'Forbidden access: Token invalid or expired' });
        }

        req.decoded = decoded;
        next();
      });
    };
    //use veryfytoken after verifytokren
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res
          .status(403)
          .send({ message: 'Forbidden access: Admin access required' });
      }
      next();
    };
    app.get(
      '/users/admin/:email',
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: 'unauthorized acceas' });
        }
        const query = { email: email };
        const user = await userCollection.findOne(query);
        let admin = false;
        if (user) {
          admin = user?.role === 'admin';
        }
        res.send({ admin });
      }
    );

    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    //delete user
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });
    //user admin update
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin',
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', instertOne });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.get('/menu/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result);
    });
    app.patch('menu/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: item.name,
          category: item.category,
          image: item.image,
        },
      };
      const result = await menuCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });
    app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
      const menuItem = req.body;
      const result = await menuCollection.insertOne(menuItem);
      res.send(result);
    });
    app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });
    app.get('/review', async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });
    //cartCollection
    app.post('/cards', async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });
    //get cartscolleaction
    app.get('/cart', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
    //peyment
    app.get('/payments/:email', async (req, res) => {
      const query = { email: req.params.email };
      // if (req.params.email === req.decoded.email) {
      //   return res.status(403).send({ message: 'forbidden acess' });
      // }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    app.post('/creact-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      console.log('Payment info', paymentResult);
      const query = {
        _id: {
          $in: payment.cartId.map(id => new ObjectId(id)),
        },
      };
      const deleteResult = await cartCollection.deleteMany(query);

      res.send({ deleteResult, paymentResult });
    });
    //addmin desboard
    app.get('/admin-stats', verifyToken, async (req, res) => {
      const user = await userCollection.estimatedDocumentCount();
      const menuItem = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();
      // const payments = await paymentCollection.find().toArray();
      // const revens = payments.reduce(
      //   (total, payment) => total + payment.price,
      //   0
      // );
      const result = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: '$price',
              },
            },
          },
        ])
        .toArray();
      const revens = result.length > 0 ? result[0].totalRevenue : 0;
      res.send({ user, menuItem, orders, revens });
    });

    // Chart Endpoint
    app.get('/order-stats', async (req, res) => {
      try {
        const result = await paymentCollection
          .aggregate([
            {
              $unwind: '$menuItemIds', // Unwind the menuItemIds array
            },
            {
              $lookup: {
                from: 'menu', // The name of the menu collection
                localField: 'menuItemIds', // Field in the current collection
                foreignField: '_id', // Field in the menu collection
                as: 'menuItems', // The output array field name
              },
            },
            {
              $unwind: '$menuItems', // Unwind the joined menuItems array
            },
            {
              $group: {
                _id: '$menuItems.category', // Group by the category field
                quantity: {
                  $sum: 1, // Count the number of items in each category
                },
              },
            },
          ])
          .toArray();

        res.send(result);
      } catch (error) {
        console.error('Error in /order-stats:', error);
        res.status(500).send({ error: 'Failed to fetch order stats.' });
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('boss is sitting');
});

app.listen(port, () => {
  console.log(`Bistro boss is sitting on port ${port}`);
});
