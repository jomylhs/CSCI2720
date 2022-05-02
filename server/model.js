const mongoose = require('mongoose')



const CommentSchema = new mongoose.Schema({
    username: String,
    content: String
}, {timestamps:{
    createdAt: 'created_at'
}})

const LocationInfoSchema = new mongoose.Schema({
    name: {
        type: String,
        unique: true,
    },
    latitude: String,
    longitude: String
})

const WeatherSchema = new mongoose.Schema({
    temp_c: Number,
    wind_kph: Number,
    precip_mm: Number,
    humidity: Number,
    vis_km: Number
})

const UserSchema = new mongoose.Schema({
    userID: Number,
    username: String,
    password: String,
    favoriteLoc: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'Location'
    }
})

const AdminSchema = new mongoose.Schema({
    adminID: Number,
    username: String,
    password: String
})

const LocationSchema = new mongoose.Schema({
    locationID: Number,
    info: LocationInfoSchema,
    comments: [CommentSchema],
    weather: WeatherSchema,
}, {timestamps: {
    updatedAt: 'updated_at'
}})

module.exports = {
    UserSchema,
    AdminSchema,
    LocationSchema
}