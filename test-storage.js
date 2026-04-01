const AsyncStorage = require('@react-native-async-storage/async-storage');

async function testStorage() {
  try {
    console.log('Testing AsyncStorage...');
    
    // Test setting a value
    await AsyncStorage.setItem('test_key', 'test_value');
    console.log('✓ Set item success');
    
    // Test getting a value
    const value = await AsyncStorage.getItem('test_key');
    console.log('✓ Get item success:', value);
    
    // Test removing a value
    await AsyncStorage.removeItem('test_key');
    console.log('✓ Remove item success');
    
    // Test getting after removal
    const removedValue = await AsyncStorage.getItem('test_key');
    console.log('✓ Get after removal:', removedValue);
    
    console.log('All tests passed!');
  } catch (error) {
    console.error('Storage test failed:', error);
  }
}

testStorage();