import Homey from 'homey';
import { CircadianDriver } from './driver'

export class CircadianZone extends Homey.Device {

  private _mode: string = "adaptive";
  private _sunsetTemp: number = 1.00;
  private _noonTemp: number = 0.40;
  private _midnightTemp: number = 1.00;
  private _sunsetBrightness: number = 0.10;
  private _noonBrightness: number = 1.00;
  private _midnightBrightness: number = 0.10;
  private _nightTemperature: number = 1.00;
  private _nightBrightness: number = 0.10;
  private _simulatedDay: string = "current";
  private _givenMonth: number = 1;
  private _givenDay: number = 1;
  private _currentBrightness: number = this._noonBrightness;
  private _currentTemperature: number = this._noonTemp;

  /**
   * set the current mode, notifying if appropriate
   */
  private async setMode(newMode: string) {
    if (this._mode != newMode) {
      this._mode = newMode;
      await this.setCapabilityValue("adaptive_mode", newMode);

      // Trigger changes
      if ((newMode == "adaptive") || (newMode == "night")) {
        this.log("Triggering zone update...");
        await this.refreshZone();
      }
      else {
        this.log(`No changes needed for new mode ${newMode}`);
      }

    }
    else {
      this.log("Mode not changed");
    }
  }

  /**
   * sets the current brightness and light temperature, changing to manual mode if needed
   */
  private async overrideCurrentBrightnessTemperature(newValues: {newBrightness: number, newTemperature: number}) {
    let valueChanged: boolean = false;

    if (newValues.newBrightness >= 0 && this._currentBrightness != newValues.newBrightness) {
      this._currentBrightness = newValues.newBrightness;
      valueChanged = true;
    }
    if (newValues.newTemperature >= 0 && this._currentTemperature != newValues.newTemperature) {
      this._currentTemperature = newValues.newTemperature;
      valueChanged = true;
    }

    if (valueChanged) {
      if (this._mode != "manual") {
        await this.setMode("manual");
      }
      await this.triggerValuesChangedFlow(this._currentBrightness, this._currentTemperature);
    }
  }

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this._mode = this.getCapabilityValue("adaptive_mode") || this._mode;
    this._sunsetTemp = (typeof this.getSetting("sunset_temp") !== "undefined") ? Math.round(this.getSetting("sunset_temp")) / 100 : this._sunsetTemp;
    this._noonTemp = (typeof this.getSetting("noon_temp") !== "undefined") ? Math.round(this.getSetting("noon_temp")) / 100 : this._noonTemp;
    this._midnightTemp = (typeof this.getSetting("midnight_temp") !== "undefined") ? Math.round(this.getSetting("midnight_temp")) / 100 : this._midnightTemp;
    if (typeof this.getSetting("min_brightness") !== "undefined" && typeof this.getSetting("max_brightness") !== "undefined" && this.getSetting("min_brightness") !== -1 && this.getSetting("max_brightness") !== -1) {
      //transfer old min_/max_brightness to noon_/sunset_/midnight_brightness ONCE
this.log('------------------ BOECHIE UPGRADING FROM OLD VERSION');
this.log('------------------ max_brightness: ', this.getSetting("max_brightness"));
this.log('------------------ min_brightness: ', this.getSetting("min_brightness"));
      this._noonBrightness = this.getSetting("max_brightness");
      this._sunsetBrightness = this.getSetting("min_brightness");
      this._midnightBrightness = this.getSetting("min_brightness");
  //await this.setSettings({min_brightness: -1, max_brightness: -1, noon_brightness: this._noonBrightness, sunset_brightness: this._sunsetBrightness, midnight_brightness: this._midnightBrightness});
    } else {
      this._noonBrightness = (typeof this.getSetting("noon_brightness") !== "undefined") ? Math.round(this.getSetting("noon_brightness")) / 100 : this._noonBrightness;
      this._sunsetBrightness = (typeof this.getSetting("sunset_brightness") !== "undefined") ? Math.round(this.getSetting("sunset_brightness")) / 100 : this._sunsetBrightness;
      this._midnightBrightness = (typeof this.getSetting("midnight_brightness") !== "undefined") ? Math.round(this.getSetting("midnight_brightness")) / 100 : this._midnightBrightness;
    }
    this._nightTemperature = (typeof this.getSetting("night_temp") !== "undefined") ? Math.round(this.getSetting("night_temp")) / 100 : this._nightTemperature;
    this._nightBrightness = (typeof this.getSetting("night_brightness") !== "undefined") ? Math.round(this.getSetting("night_brightness")) / 100 : this._nightBrightness;
    this._simulatedDay = this.getSetting("simulated_day") || this._simulatedDay;
    this._givenMonth = this.getSetting("given_month") || this._givenMonth;
    this._givenDay = this.getSetting("given_day") || this._givenDay;
    this._currentTemperature = (typeof this.getCapabilityValue("light_temperature") !== "undefined") ? this.getCapabilityValue("light_temperature") : this._currentTemperature;
    this._currentBrightness = (typeof this.getCapabilityValue("dim") !== "undefined") ? this.getCapabilityValue("dim") : this._currentBrightness;

    await this.setCapabilityValue("adaptive_mode", this._mode);
    await this.setCapabilityValue("light_temperature", this._currentTemperature);
    await this.setCapabilityValue("dim", this._currentBrightness);

    // Mode Listener
    this.registerCapabilityListener("adaptive_mode", async (value) => {
      this.log(`Mode changed to ${value}`)
      await this.setMode(value);    
    });

    // Temperature Override Listener
    this.registerCapabilityListener("light_temperature", async (newTemperature) => {
      this.log(`Temperature override to ${newTemperature}`);
      await this.overrideCurrentBrightnessTemperature({newBrightness: -1, newTemperature});
    });

    // Dim Override Listener
    this.registerCapabilityListener("dim", async (newBrightness) => {
      this.log(`Dim override to ${newBrightness}`);
      await this.overrideCurrentBrightnessTemperature({newBrightness, newTemperature: -1});
    });

    this.log('CircadianZone has been initialized');
    await this.refreshZone();
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('CircadianZone has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings(event: { oldSettings: {}, newSettings: {noon_brightness: number, sunset_brightness: number, midnight_brightness: number, night_brightness: number, night_temp: number, noon_temp: number, sunset_temp: number, midnight_temp: number, simulated_day: string, given_month: number, given_day: number}, changedKeys: [string] }): Promise<string|void> {
    // Sanity check, not needed! sunset_temp can be <= noon_temp, especially needed when you want to invert the algorithm as requested.
    // if (!(event.newSettings.sunset_temp > event.newSettings.noon_temp)) {
    //   return this.homey.__("temperature_error");
    // }

    // Update settings
    this.log(`CircadianZone settings were changed - ${JSON.stringify(event.newSettings)}`);
    this._noonBrightness = event.newSettings.noon_brightness / 100;
    this._sunsetBrightness = event.newSettings.sunset_brightness / 100;
    this._midnightBrightness = event.newSettings.midnight_brightness / 100;
    this._noonTemp = event.newSettings.noon_temp / 100;
    this._sunsetTemp = event.newSettings.sunset_temp / 100;
    this._midnightTemp = event.newSettings.midnight_temp / 100;
    this._nightBrightness = event.newSettings.night_brightness / 100;
    this._nightTemperature = event.newSettings.night_temp / 100;
    if (event.changedKeys.includes('simulated_day') || event.changedKeys.includes('given_month') || event.changedKeys.includes('given_day')) {
      this._simulatedDay = event.newSettings.simulated_day;
      switch(this._simulatedDay) {
        case 'march_equinox': {
          this._givenMonth = 3;
          this._givenDay = 20;
          break;
        }
        case 'june_solstice': {
          this._givenMonth = 6;
          this._givenDay = 21;
          break;
        }
        case 'september_equinox': {
          this._givenMonth = 9;
          this._givenDay = 22;
          break;
        }
        case 'december_solstice': {
          this._givenMonth = 12;
          this._givenDay = 21;
          break;
        }
        default: {
          this._givenMonth = event.newSettings.given_month;
          this._givenDay = event.newSettings.given_day;
          if (this._givenMonth == 2 && this._givenDay == 29) {
            this._givenDay = 28;
          }
          let given = new Date((new Date()).getFullYear(), this._givenMonth - 1, this._givenDay);
          this._givenMonth = given.getMonth() + 1;
          this._givenDay = given.getDate();
        }
      }
      setTimeout(async () => {
        await this.setSettings({given_month: this._givenMonth, given_day: this._givenDay});
        this.refreshZone();
      }, 1);
    } else {
      await this.refreshZone();
    }
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log('CircadianZone was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('CircadianZone has been deleted');
  }

  /**
   * refreshZone updates the zone values, based on mode and circadian progress
   */
  private async refreshZone() {
    if (this._mode == "adaptive") {
      await this.updateFromPercentage((this.driver as CircadianDriver).getPercentage()); 
    }
    else if (this._mode == "night") {
      await this.updateFromNightMode();
    }
  }

  /**
   * updateFromNightMode is called when the mode is forcibly set to night mode
   */
  private async updateFromNightMode() {
    if ((this._currentBrightness != this._nightBrightness) || (this._currentTemperature != this._nightTemperature)) {
      this.log(`Updating to night brightness ${this._nightBrightness * 100}% and temperature ${this._nightTemperature * 100}%...`);
      this._currentBrightness = this._nightBrightness;
      this._currentTemperature = this._nightTemperature;
      await this.setCapabilityValue("dim", this._nightBrightness);
      await this.setCapabilityValue("light_temperature", this._nightTemperature);

      // Trigger flow if appropriate
      await this.triggerValuesChangedFlow(this._nightBrightness, this._nightTemperature);
    }
    else {
      this.log("Already at night targets.");
    }
  }

  /**
   * updateFromPercentage is called when the global circadian tracking percentage is recalculated
   */
  public async updateFromPercentage(percentage: number) {

    let valuesChanged: boolean = false;

    // Sanity check for adaptive mode
    if (this._mode != "adaptive") {
      this.log(`${this.getName()} is not in adaptive mode. (${this._mode})`);
      return;
    }

    this.log(`${this.getName()} is updating from percentage ${percentage * 100}%...`);

    //BOECHIE TODO
    //await this.setCapabilityValue("percentage", percentage);

    // Brightness
    const brightnessDelta = this._noonBrightness - this._sunsetBrightness;
    let brightness = Math.round(((percentage > 0) ? (brightnessDelta * percentage) + this._sunsetBrightness : this._sunsetBrightness) * 100) / 100;
    if (brightness != this._currentBrightness) {
      this._currentBrightness = brightness;
      await this.setCapabilityValue("dim", brightness);
      valuesChanged = true;
      this.log(`Brightness updated to be ${brightness * 100}% in range ${this._sunsetBrightness * 100}% - ${this._noonBrightness * 100}%`);
    }
    else {
      this.log(`No change in brightness from ${this._currentBrightness}%`)
    }

    // Temperature
    const tempDelta = this._sunsetTemp - this._noonTemp;
    let calculatedTemperature = (tempDelta * (1-percentage)) + this._noonTemp; // Temperature gets less (or more, when inverted) as we move to noon
    let temperature = Math.round(((percentage > 0) ? calculatedTemperature : this._sunsetTemp) * 100) / 100;
    if (temperature != this._currentTemperature) {
      this._currentTemperature = temperature;
      this.log(`Temperature updated to be ${temperature * 100}% in range ${this._sunsetTemp * 100}% - ${this._noonTemp * 100}%`);
      await this.setCapabilityValue("light_temperature", temperature);
      valuesChanged = true;
      this.log(`Temperature updated to be ${temperature * 100}% in range ${this._sunsetTemp * 100}% - ${this._noonTemp * 100}%`);
    }
    else {
      this.log(`No change in temperature from ${this._currentTemperature * 100}%`)
    }

    // Trigger flow if appropriate
    if (valuesChanged) {
      await this.triggerValuesChangedFlow(brightness, temperature);
    }

  }

  private async triggerValuesChangedFlow(brightness: number, temperature: number) {
    this.log(`Triggering values changed with temperature ${temperature} and brightness ${brightness}`);
    return (this.driver as CircadianDriver).triggerValuesChangedFlow(this, {
      brightness: brightness,
      temperature: temperature
    }, {});
  }
}

module.exports = CircadianZone;
