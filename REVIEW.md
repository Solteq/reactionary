# Review priorities
Return review items annotated as conventional review comments

- Does the code differ significantly in structure from rest of codebase. Uniformity of concepts and choices are important.

- Since this is a shared library, are the changes made, such that it can be subclassed or overwritten by a consumer? This is important to not become a blocked in a particular project.

- Avoid putting logic in global utility functions for things that could conceivably ever need to be subclassed

- Is the complexity of the code larger than it has to be. Prefer readability over efficiency in most cases.

- Are we doing something that raises the security profile of the code? 

- Since this is core code, it must never throw an exception to the outside. Functions with @Reactionary already deal with this, but other functions should take care too.

- Is everything modelled as schemas. Can those schemas be extended? Avoid anonymous types or tuples.

- All changes to public api, should be marked in the commit message as a breaking change. These should only occur when absolutely necessary.

- Normal typescript reviews for "strict" mode.


