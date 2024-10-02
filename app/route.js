const formValidator = require('./form_validator');
const publishMessage = require('./publishMessage');
const photoModel = require('./photo_model');
const { jobStatus } = require('./listenForMessages');
const { checkTokenBucket } = require('./tokenBucket');

function route(app) {
  app.get('/', async (req, res) => {
    const result = await checkTokenBucket(req);
    if (!result.allowed) {
      return res.status(500).send({
        error: 'Failed cause to limitation !',
        message: 'Tip : Stop flooding'
      });
    }
    const tags = req.query.tags;
    const tagmode = req.query.tagmode;

    const ejsLocalVariables = {
      tagsParameter: tags || '',
      tagmodeParameter: tagmode || '',
      photos: [],
      searchResults: false,
      invalidParameters: false,
      jobStatus
    };

    // if no input params are passed in then render the view with out querying the api
    if (!tags && !tagmode) {
      return res.render('index', ejsLocalVariables);
    }

    // validate query parameters
    if (!formValidator.hasValidFlickrAPIParams(tags, tagmode)) {
      ejsLocalVariables.invalidParameters = true;
      return res.render('index', ejsLocalVariables);
    }

    // get photos from flickr public feed api
    return photoModel
      .getFlickrPhotos(tags, tagmode)
      .then(photos => {
        ejsLocalVariables.photos = photos;
        ejsLocalVariables.searchResults = true;
        return res.render('index', ejsLocalVariables);
      })
      .catch(error => {
        return res.status(500).send({ error });
      });
  });

  app.post('/zip', async (req, res) => {
    const tags = req.body.tags;

    if (!tags || !formValidator.isValidCommaDelimitedList(tags)) {
      return res.status(400).send({ error: 'Invalid tags provided' });
    }

    try {
      console.log('Calling publishMessage with tags:', tags);
      const result = await checkTokenBucket(req);
      if (result.allowed) await publishMessage(tags);
      console.log(result.message);
      console.log('Redirecting...');
      return res.redirect('/');
    } catch (error) {
      console.error(`Error in /zip route: ${error.message}`);
      return res.status(500).send({ error: 'Failed to publish message' });
    }
  });
}

module.exports = route;
