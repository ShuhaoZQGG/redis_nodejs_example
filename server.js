const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createClient } = require('redis');

  const redisClient = createClient({
    legacyMode: true
  });
  (async() => {
    await redisClient.connect();
  })();
  const DEFAULT_EXPIRATION = 3600
  const app = express();
  app.use(cors());
  
  redisClient.on('error', (err) => console.log('Redis Client Error', err));
  redisClient.on('connect', function() {
    console.log('Connected!');
  });
  app.get('/', (_req, res) => {
    return res.json('hello redis');
  })
  
  app.get('/photos', async (req, res) => {
    try {
      let photos;
      const albumId = req.query.albumId
      if (albumId) {
        photos = await handleCache(`photos?albumId=${albumId}`, async() => {
          const { data } = await axios.get(
            'https://jsonplaceholder.typicode.com/photos',
            { params: { albumId }}
          );
    
          return data
        })
      } else {
        photos = await handleCache('photos', async() => {
          const { data } = await axios.get(
            'https://jsonplaceholder.typicode.com/photos'
          );
    
          return data
        })
      }

  
      return res.json(photos);
    } catch (err) {
      console.error(err);
    }
  })
  
  app.get('/photos/:id', async(req, res) => {
    const photo = await handleCache(`photos:${req.params.id}`, async() => {
      const { data } = await axios.get(
        `https://jsonplaceholder.typicode.com/photos/${req.params.id}`
      );

      return data
    })
  
    res.json(photo);
  })
  
  const handleCache = (key, cb) => {
    return new Promise(async (resolve, reject) => {
      await redisClient.get(key, async(err, data) => {
        if (err) reject(err);
        if (data) return resolve(JSON.parse(data));
        const newData = await cb();
        await redisClient.setEx(key, DEFAULT_EXPIRATION, JSON.stringify(newData));
        return resolve(newData);
      })
    })
  }

  app.listen(5000, () => {
    console.log('Listening')
  })

