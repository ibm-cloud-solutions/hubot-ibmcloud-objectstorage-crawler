# Object Storage Tag Generators

This directory contains 'tag generators' that are able to generate 'tags' from documents stored in objectstorage.
These are dynamically loaded by the search engine and used to get the training data used to train NLC.

## Contract

Each tag generator is expected to implement the following methods:

1. Constructor that checks for any setup that is required.  For example, ensure environment variables are set with credentials to the services it needs to access.
2. initializedSuccessfully() returns a boolean indicating whether or not initialization was successful.
3. getMissingEnv() if initialization fails due to environment variables not being set, this method will return a string with the missing variable.
4. isFileTypeSupported() returns a boolean indicate if the file type for the provided object storage object information is supported by this generator.  The passed in object contains the following info:
  
    ```
        {
 			containerName: // name of container this object belongs to
 			objectName: // name of the object
 			metadata: // metadata from object storage for this object (content-type, size, custome metadata)
 		}
    ```
5. generateTags() returns array of strings 'tags' which are used to train NLC for this object.
