const mongoose = require('mongoose')
const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const fetch = require('node-fetch')
require('dotenv').config()
const fs = require('fs')
const cors = require('cors')

const {UserSchema, AdminSchema, LocationSchema} = require('./model')



mongoose.connect(process.env.DB_SERVER_URL);
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', function(){
    console.log("Connection is open...")
})

const User = mongoose.model('User', UserSchema)
const Admin = mongoose.model('Admin', AdminSchema)
const Location = mongoose.model('Location', LocationSchema)

const app = express()
app.listen(3000)

app.use(express.json())
app.use(cors({
    origin: '*'
}))



app.use((req, res, next)=>{

    const content = JSON.stringify({
        'Request Time': new Date().toUTCString(),
        'User IP': req.ip,
        'User browser info': req["user-agent"],
        'Request method': req.method,
        'Request URL': req.url
    }, null, 2)
    console.log(content)
    fs.appendFile('log.txt', content, err=>{
        if(err){
            console.log(err);
        }
    })
    fs.appendFile('log.txt', '\n', err=>{
        if(err){
            console.log(err);
        }
    })
    next()
})



app.post('/users/signUp', async (req, res)=>{
    const {username, password} = req.body;
  
    try{
        if(await User.findOne({username})){
            return res.status(403).send()
        }
        const hashedPassword = await bcrypt.hash(password, 10)
        const userID = await User.find().sort({userID:-1}).limit(1).then(users=> users.length == 0 ? 1 : users[0].userID+1)
        
        User.create({
            userID,
            username,
            password: hashedPassword,
        })
        console.log('userCreated')
        
        res.status(201).send()
    }
    catch{
      res.status(500).send()
    }
  
  })

app.post('/users/login', async (req, res)=>{
    const {username, password} = req.body
    const user = await User.findOne({username: username})
    if(user==null){
        res.status(400).json({message: 'Cannot find user'})
    }
    try{
        if(await bcrypt.compare(password, user.password)){
            const payload = {
                id: user.id
            }
            const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET)
            return res.json({accessToken: accessToken, message: 'Login Successfully'})

        }
        else{
            return res.status(403).json({message: 'wrong password'})
        }
    }
    catch{
        res.status(500).send()
    }
})

app.get('/users/location/get/:locID', authenticateToken, async(req,res)=>{
    
    const {locID} = req.params
    const location = await Location.findOne({locationID: locID})

    if(!location){
        return res.sendStatus(404)
    }

    const weather = await fetch(`http://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${location.info.name}`).then(res=>res.json()).then(res=>res.current)
    location.weather = {
        temp_c: weather.temp_c,
        wind_kph: weather.wind_kph,
        wind_dir: weather.wind_dir,
        precip_mm: weather.precip_mm,
        humidity: weather.humidity,
        vis_km: weather.vis_km
    }

    await location.save()

    const updatedLocation = await Location.findOne({locationID: locID})

    res.send(updatedLocation)


})

app.get('/users/favorite', authenticateToken , async(req, res)=>{

    const populateRes = await req.user.populate('favoriteLoc')

    res.send(populateRes.favoriteLoc)

})

app.post('/users/favorite/create/:locID', authenticateToken , async(req, res)=>{

    const {locID} = req.params
    const location = await Location.findOne({locationID: locID})

    if(!location){
        return res.sendStatus(404)
    }
    if(!req.user.favoriteLoc.find(locID => locID == location.id)){
        req.user.favoriteLoc.push(location.id)
    }

    await req.user.save()

    res.send()

})

app.delete('/users/favorite/delete/:locID', authenticateToken , async(req, res)=>{

    const {locID} = req.params
    const location = await Location.findOne({locationID: locID})

    if(!location){
        return res.sendStatus(404)
    }

    req.user.favoriteLoc = req.user.favoriteLoc.filter((locID) => locID != location.id)
    await req.user.save()

    res.send()

})

app.get('/users/locations', authenticateToken, async(req,res)=>{
    const locations = await Location.find()

    locations.forEach(async(location)=>{
        const weather = await fetch(`http://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${location.info.name}`).then(res=>res.json()).then(res=>res.current)
        location.weather = {
            temp_c: weather.temp_c,
            wind_kph: weather.wind_kph,
            wind_dir: weather.wind_dir,
            precip_mm: weather.precip_mm,
            humidity: weather.humidity,
            vis_km: weather.vis_km
        }

        await location.save();
    })

    const updatedLocations = await Location.find()

    return res.send(updatedLocations)
})

app.get('/users/location/search/:nameQuery?', authenticateToken, async(req, res)=>{
 
   
    const nameQuery = req.params ? req.params.nameQuery : ''
    let locations
    if(nameQuery){
        locations = await Location.find({'info.name': {
                "$regex": nameQuery,
                "$options": 'i'}})
    }
    else{
        locations = await Location.find()
    }



    return res.send(locations)
})

app.post('/users/comment', authenticateToken ,async(req, res)=>{
 
   
    const {locID, content} = req.body

    const location = await Location.findOne({locationID: locID})
    if(!location){
        return res.sendStatus(404)
    }

    location.comments.push({
        username: req.user.username,
        content: content
    })

    await location.save()

    return res.send()
})

app.get('/users/username', authenticateToken, (req, res)=>{
    return res.send(req.user.username)

})



app.post('/admin/signUp', async (req, res)=>{
    const {username, password} = req.body;
  
    try{
        if(await Admin.findOne({username})){
            return res.status(403).send()
        }
      const hashedPassword = await bcrypt.hash(password, 10)
      const adminID = await Admin.find().sort({adminId:-1}).limit(1).then(admins=> admins.length == 0 ? 1 : admins[0].adminID+1)
    
      Admin.create({
        adminID,
        username,
        password: hashedPassword,
      })
      console.log('adminCreated')
      
      res.status(201).send()
    }
    catch{
      res.status(500).send()
    }
  
  })

app.post('/admin/login', async (req, res)=>{
    const {username, password} = req.body
    const admin = await Admin.findOne({username: username})
    if(admin==null){
        res.status(400).json({message: 'Cannot find admin user'})
    }
    try{
        if(await bcrypt.compare(password, admin.password)){
            const payload = {
                id: admin.id
            }
            const accessToken = jwt.sign(payload, process.env.ACCESS_ADMIN_TOKEN_SECRET)
            res.json({accessToken: accessToken, message: 'Login Successfully'})

        }
        else{
            res.status(403).json({message: 'wrong password'})
        }
    }
    catch{
        res.status(500).send()
    }
})

app.get('/admin/updateLocationsData', authenticateAdminToken, async(req, res)=>{
    const locations = await Location.find()

    locations.forEach(async(location)=>{
        const weather = await fetch(`http://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${location.info.name}`).then(res=>res.json()).then(res=>res.current)
        location.weather = {
            temp_c: weather.temp_c,
            wind_kph: weather.wind_kph,
            wind_dir: weather.wind_dir,
            precip_mm: weather.precip_mm,
            humidity: weather.humidity,
            vis_km: weather.vis_km
        }

        await location.save();
    })

    const updatedLocations = await Location.find()

    return res.send(updatedLocations)
})



app.post('/admin/location/create', authenticateAdminToken, async (req, res)=>{
    const {name} = req.body;
    
    try{
        const weatherAPIres = await fetch(`http://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${name}`)


        if(!weatherAPIres.ok){
            return res.sendStatus(404)
        }
  
        if(await Location.findOne({'info.name': name})){
            return res.sendStatus(403)
        }
        const location = await weatherAPIres.json().then(result=>result.location)
        const locationID = await Location.find().sort({locationID: -1}).limit(1).then(locations=> locations.length == 0 ? 1 : locations[0].locationID+1)


        Location.create({
            locationID,
            info: {
                name: location.name,
                latitude: location.lat,
                longitude: location.lon
            },
        })
        console.log('Location Created')
        
        return res.status(201).send()
    }
    catch(err){
        console.log(err)
        return res.status(500).send()
    }
  
})


app.get('/admin/location/read/:locationID', authenticateAdminToken, async(req, res)=>{

    try{
        const location = await Location.findOne({locationID: req.params.locationID})
        if(!location){
           return res.status(404).send()
        }
        res.status(200).send(location)
    }
    catch{
      res.status(500).send()
    }
})

app.get('/admin/location/read', authenticateAdminToken, async(req, res)=>{
  
    try{
        const locations = await Location.find()
        
        res.status(200).send(locations)
    }
    catch{
      res.status(500).send()
    }
})

app.post('/admin/location/update', authenticateAdminToken, async(req, res)=>{
    const {locationID, name} = req.body;
    
    try{
        const locationToUpdate = await Location.findOne({locationID})

        if(!locationToUpdate){
            return res.sendStatus(404)
        }

        const weatherAPIres = await fetch(`http://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${name}`)


        if(!weatherAPIres.ok){
            return res.sendStatus(404)
        }
  
        if(await Location.findOne({'info.name': name})){
            return res.sendStatus(403)
        }

        const result = await weatherAPIres.json()
        const location = result.location
        const weather = result.current
        console.log(weather)


        
        
        locationToUpdate.info = {
                name: location.name,
                latitude: location.lat,
                longitude: location.lon
        },

        locationToUpdate.weather = {
            temp_c: weather.temp_c,
            wind_kph: weather.wind_kph,
            wind_dir: weather.wind_dir,
            precip_mm: weather.precip_mm,
            humidity: weather.humidity,
            vis_km: weather.vis_km
        }

        await locationToUpdate.save()
        
        return res.status(200).send()
    }
    catch(err){
        console.log(err)
        return res.status(500).send()
    }
})


app.delete('/admin/location/delete', authenticateAdminToken, async(req, res)=>{
  
    try{
        const {locationID} = req.body
        if(!locationID){
            return res.status(404).send()
        }
        await Location.deleteOne({locationID})
        return res.status(200).send()
    }
    catch{
      return res.status(500).send()
    }
})

app.post('/admin/users/create', authenticateAdminToken, async(req, res)=>{
    const {username, password} = req.body;
  
    try{
        if(await User.findOne({username})){
            return res.status(403).send()
        }
        const hashedPassword = await bcrypt.hash(password, 10)
        const userID = await User.find().sort({userID:-1}).limit(1).then(users=> users.length == 0 ? 1 : users[0].userID+1)
        User.create({
            userID,
            username,
            password: hashedPassword,
        })
        console.log('userCreated')
        
        res.status(201).send()
    }
    catch{
      res.status(500).send()
    }
})

app.get('/admin/users/read/:userID', authenticateAdminToken, async(req, res)=>{
    console.log(req.params.userID)
    try{
        const user = await User.findOne({userID: req.params.userID})
        if(!user){
           return res.status(404).send()
        }
        res.status(200).send(user)
    }
    catch{
      res.status(500).send()
    }
})

app.get('/admin/users/read', authenticateAdminToken, async(req, res)=>{
  
    try{
        const users = await User.find()
        
        res.status(200).send(users)
    }
    catch{
      res.status(500).send()
    }
})

app.post('/admin/users/update', authenticateAdminToken, async(req, res)=>{
  
    try{
        const {userID, username, password} = req.body
        const user = await User.findOne({userID})
        if(!user){
            return res.status(404).send()
        }

        if(password){
            const hashedPassword = await bcrypt.hash(password, 10)
            user.password = hashedPassword
        }

        if(username){
            user.username = username
        }

        await user.save()
        return res.status(200).send(user)
    }
    catch{
      return res.status(500).send()
    }
})

app.delete('/admin/users/delete', authenticateAdminToken, async(req, res)=>{
  
    try{
        const {userID} = req.body
        if(!userID){
            return res.status(404).send()
        }
        await User.deleteOne({userID})
        return res.status(200).send()
    }
    catch{
      return res.status(500).send()
    }
})





function authenticateAdminToken(req, res, next){
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if(token == null) return res.status(401).send({message: 'Please login'})

    jwt.verify(token, process.env.ACCESS_ADMIN_TOKEN_SECRET, async(err, user)=>{
        
        if(err) return res.sendStatus(403)
        req.admin = await Admin.findById(user.id)
        next()
    })
}


function authenticateToken(req, res, next){
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if(token == null) return res.status(401).send({message: 'Please login'})

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async(err, user)=>{
        
        if(err) return res.sendStatus(403)
        req.user = await User.findById(user.id)
        next()
    })
}