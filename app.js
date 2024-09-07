const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const cron = require('node-cron');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// Load Discord configuration
const { token, channelId, timeZone, PORT } = require('./config.json');

// Initialize Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// lets fucking gooooooo
client.login(token);

// Load schedule from JSON file
let schedule = require('./schedule.json');

// Initialize Express app
const app = express();

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Function to send a reminder message to Discord
async function sendReminderMessage(subject, time, room) {
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle('Напоминание о занятиях')
    .setDescription(`Предмет **${subject}** начинаются в **${time}** в конференцией **${room}**.`)
    .setTimestamp();

  const channel = await client.channels.fetch(channelId);
  if (channel) {
    channel.send({
      content: '@everyone', // This mentions everyone in the channel
      embeds: [embed]
    }).catch(err => {
      console.error('Failed to send message:', err);
    });
  } else {
    console.error('Channel not found or not cached. Trying to fetch...');
    client.channels.fetch(channelId)
      .then(channel => {
        channel.send({
          content: '@everyone', // This mentions everyone in the channel
          embeds: [embed]
        }).catch(err => {
          console.error('Failed to send message after fetching channel:', err);
        });
      })
      .catch(err => {
        console.error('Failed to fetch channel:', err);
      });
  }
}


// Function to get cron day from weekday name
function getCronDay(day) {
  switch (day.toLowerCase()) {
    case 'monday': return '1';
    case 'tuesday': return '2';
    case 'wednesday': return '3';
    case 'thursday': return '4';
    case 'friday': return '5';
    case 'saturday': return '6';
    case 'sunday': return '0';
    default: return '*'; // Fallback for any incorrect day inputs
  }
}

// Schedule notifications based on the schedule data
function scheduleNotifications() {
  // Stop existing tasks to avoid duplication
  cron.getTasks().forEach(task => task.stop()); 
  
  schedule.forEach(entry => {
    const [hour, minute] = entry.time.split(':');
    const dayOfWeek = getCronDay(entry.day);
	  // console.log('1');
    // Correct cron pattern: 'minute hour * * dayOfWeek'
    cron.schedule(`${minute} ${hour} * * ${dayOfWeek}`, () => {
      sendReminderMessage(entry.subject, entry.time, entry.room);
    }, {
      timezone: timeZone, // Set to your timezone
    });
  });
}

// Call function to schedule initial notifications
client.once('ready', () => {
  console.log('Discord bot is online!');
  
});

scheduleNotifications();
	
client.login(token).catch(err => {
  console.error('Failed to login to Discord:', err);
});

// Route to display the schedule
app.get('/', (req, res) => {
  res.render('index', { schedule });
});

// Route to display the edit form
app.get('/edit', (req, res) => {
  res.render('edit', { schedule });
});

// Route to handle adding a new entry
app.post('/add', (req, res) => {
  const newEntry = {
    day: req.body.day,
    time: req.body.time,
    subject: req.body.subject,
    room: req.body.room
  };
  schedule.push(newEntry);
  saveSchedule();
  res.redirect('/edit');
});

// Route to handle updating an entry
app.post('/update/:index', (req, res) => {
  const index = req.params.index;
  if (index >= 0 && index < schedule.length) {
    schedule[index] = {
      day: req.body.day,
      time: req.body.time,
      subject: req.body.subject,
      room: req.body.room
    };
    saveSchedule();
  }
  res.redirect('/edit');
});

// Route to handle deleting an entry
app.post('/delete/:index', (req, res) => {
  const index = req.params.index;
  if (index >= 0 && index < schedule.length) {
    schedule.splice(index, 1);
    saveSchedule();
  }
  res.redirect('/edit');
});

// Function to save schedule to JSON file and reschedule notifications
function saveSchedule() {
  fs.writeFile('./schedule.json', JSON.stringify(schedule, null, 2), err => {
    if (err) {
      console.error('Error saving schedule:', err);
    } else {
      console.log('Schedule updated successfully!');
      // Re-schedule notifications with updated data
      scheduleNotifications();
    }
  });
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
