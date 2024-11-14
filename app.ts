import Homey from 'homey';

class CircadianLighting extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('CircadianLighting has been initialized');
  }

}

module.exports = CircadianLighting;
