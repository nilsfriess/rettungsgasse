## Rescue Alley API  

Some people tend to forget to form a rescue alley while driving towards or in a traffic jam. Reminding them (on the radio, through push notifications on their phones or on the display of their infotainment systems) too often and in situations where rescue alleys aren't really needed just annoys them.  
We found a solution that can be widely used and won't annoy the driver because we only tell them to form a rescue alley if it's really necessary. 


**What this API does**  
You send us two coordinates (latitude longitude) of you (e.g. your current position and your position 20 seconds ago).
With the use of traffic data provided by the police, we then decide whether you are driving towards a traffic jam or are already in one that is caused by an accident.
Depending on these information and other data like your distance to the accident our API will tell you if you should form a rescue alley.

**How to use this API**   
Just go to:

```
https://rescuealley.tech/api/lonlat/45.212,7.2113+45.234,7.244
```
The two coordinates must be separated by a '+' and latitude and longitude must be separated by a comma. 

The response you get is a JSON-Object, which will look like this:

``` javascript
{
   "shouldShowWarning": false,
   "information": {
      "message": "No traffic jams found in your area..",
      "streetName":"",
      "warning":""
   }
}
```
```shouldShowWarning``` is ```true``` if you should form a rescue alley.   
