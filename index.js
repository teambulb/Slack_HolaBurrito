require('dotenv').config();
const ts = require('tinyspeck'),
      PORT = process.env.PORT || 8080,
	  TOKEN = process.env.TOKEN,
	  REQUEST_URL =  process.env.REQUEST_URL,
      users = {};

	  console.log(TOKEN);

// setting defaults for all Slack API calls
let slack = ts.instance({ token: TOKEN });

// event handler
//'reaction_added', 'message', 'message.channels'
slack.on('reaction_added', 'message', payload => {
  //let {type, user, item} = payload.event;
  //let message = 'Hello';
  
  console.log("Testing against");
  console.log(payload.event.type);
  console.log(payload);
  
  if (payload.event.reaction === 'burrito') {
	  
	  console.log('inside');
	  
	  var message = {
		  channel: payload.event.item.channel,
		  token: TOKEN,
		  text: 'You gave <@' + payload.event.user + '> a burrito'
	  }
	  
	  slack.send(REQUEST_URL, { text: 'Hello you gave a burrito to ' }).then(res => {
		  console.log( 'Successfully answered the command' );
	  }).catch(console.error);
  } else if (payload.event.text.indexOf(':burrito:') > 0) {
	  
	  var userGivenBurrito = payload.event.text.match(/<(.*)>/);
	  console.log(userGivenBurrito);
	  
	  slack.send(REQUEST_URL, { token: TOKEN, text: 'Hello you gave a burrito to ' + userGivenBurrito[0], as_user: false, channel: payload.event.user }).then(res => {
		  console.log( 'Successfully answered the command' );
	  }).catch(console.error);
  }
});


// incoming http requests
slack.listen(PORT);