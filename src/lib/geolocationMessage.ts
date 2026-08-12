export type GeolocationFailure = {
  title: string
  message: string
}

export function geolocationFailure(code?: number): GeolocationFailure {
  if (code === 1) {
    return {
      title: 'Location access is switched off',
      message: 'You can allow it in your browser settings, or search for a place below — you’ll get the same eclipse result.',
    }
  }
  if (code === 2) {
    return {
      title: 'This device couldn’t work out where it is',
      message: 'This can happen on desktop computers and Wi-Fi-only tablets. Search for a nearby town or postcode instead.',
    }
  }
  if (code === 3) {
    return {
      title: 'Finding your location took too long',
      message: 'Your connection or location hardware may be unavailable. Search for a nearby place instead.',
    }
  }
  return {
    title: 'Location isn’t available on this device',
    message: 'Search for a nearby town, postcode or address instead — it works just as well.',
  }
}
